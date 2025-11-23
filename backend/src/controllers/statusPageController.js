const { validationResult } = require('express-validator');
const db = require('../config/database');

const createStatusPage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subdomain, title, description, logo_url, monitors, theme, is_public = true } = req.body;

    // Check if subdomain is available
    const { rows: existing } = await db.query(
      'SELECT id FROM status_pages WHERE subdomain = $1',
      [subdomain]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Subdomain is already taken' });
    }

    const { rows } = await db.query(
      `INSERT INTO status_pages (
        organization_id, subdomain, title, description, logo_url,
        monitors, theme, is_public
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        req.organization.id,
        subdomain,
        title,
        description || null,
        logo_url || null,
        JSON.stringify(monitors || []),
        JSON.stringify(theme || {}),
        is_public
      ]
    );

    res.status(201).json({
      message: 'Status page created successfully',
      statusPage: rows[0],
      url: `https://${subdomain}.status.pulseapi.dev`
    });
  } catch (error) {
    console.error('Create status page error:', error);
    res.status(500).json({ error: 'Failed to create status page' });
  }
};

const getStatusPages = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM status_pages WHERE organization_id = $1 ORDER BY created_at DESC',
      [req.organization.id]
    );

    res.json({ statusPages: rows });
  } catch (error) {
    console.error('Get status pages error:', error);
    res.status(500).json({ error: 'Failed to fetch status pages' });
  }
};

const getStatusPage = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      'SELECT * FROM status_pages WHERE id = $1 AND organization_id = $2',
      [id, req.organization.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Status page not found' });
    }

    res.json({ statusPage: rows[0] });
  } catch (error) {
    console.error('Get status page error:', error);
    res.status(500).json({ error: 'Failed to fetch status page' });
  }
};

const updateStatusPage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, logo_url, monitors, theme, is_public } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (logo_url !== undefined) {
      updates.push(`logo_url = $${paramCount}`);
      values.push(logo_url);
      paramCount++;
    }

    if (monitors) {
      updates.push(`monitors = $${paramCount}`);
      values.push(JSON.stringify(monitors));
      paramCount++;
    }

    if (theme) {
      updates.push(`theme = $${paramCount}`);
      values.push(JSON.stringify(theme));
      paramCount++;
    }

    if (is_public !== undefined) {
      updates.push(`is_public = $${paramCount}`);
      values.push(is_public);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id, req.organization.id);

    const { rows } = await db.query(
      `UPDATE status_pages SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Status page not found' });
    }

    res.json({
      message: 'Status page updated successfully',
      statusPage: rows[0]
    });
  } catch (error) {
    console.error('Update status page error:', error);
    res.status(500).json({ error: 'Failed to update status page' });
  }
};

const deleteStatusPage = async (req, res) => {
  try {
    const { id } = req.params;

    const { rowCount } = await db.query(
      'DELETE FROM status_pages WHERE id = $1 AND organization_id = $2',
      [id, req.organization.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Status page not found' });
    }

    res.json({ message: 'Status page deleted successfully' });
  } catch (error) {
    console.error('Delete status page error:', error);
    res.status(500).json({ error: 'Failed to delete status page' });
  }
};

/**
 * Public endpoint - Get status page by subdomain
 */
const getPublicStatusPage = async (req, res) => {
  try {
    const { subdomain } = req.params;

    const { rows } = await db.query(
      'SELECT * FROM status_pages WHERE subdomain = $1 AND is_public = true',
      [subdomain]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Status page not found' });
    }

    const statusPage = rows[0];

    // Get monitor statuses
    if (statusPage.monitors && statusPage.monitors.length > 0) {
      const { rows: monitors } = await db.query(
        `SELECT m.id, m.name, m.url,
          (SELECT is_up FROM monitor_checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as current_status,
          (SELECT AVG(response_time)::int FROM monitor_checks WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '24 hours') as avg_response_time,
          (SELECT COUNT(*) FROM incidents WHERE monitor_id = m.id AND status = 'open') as open_incidents
         FROM monitors m
         WHERE m.id = ANY($1::UUID[])`,
        [statusPage.monitors]
      );

      // Get recent incidents
      const { rows: incidents } = await db.query(
        `SELECT id, monitor_id, title, severity, status, started_at, resolved_at
         FROM incidents
         WHERE monitor_id = ANY($1::UUID[])
           AND started_at > NOW() - INTERVAL '7 days'
         ORDER BY started_at DESC
         LIMIT 10`,
        [statusPage.monitors]
      );

      // Calculate overall status
      const allUp = monitors.every(m => m.current_status === true);
      const someDown = monitors.some(m => m.current_status === false);
      const hasOpenIncidents = incidents.some(i => i.status === 'open' || i.status === 'investigating');

      let overallStatus = 'operational';
      if (someDown || hasOpenIncidents) {
        overallStatus = 'degraded';
      }
      if (monitors.every(m => m.current_status === false)) {
        overallStatus = 'down';
      }

      res.json({
        title: statusPage.title,
        description: statusPage.description,
        logo_url: statusPage.logo_url,
        theme: statusPage.theme,
        overall_status: overallStatus,
        monitors,
        recent_incidents: incidents,
        updated_at: new Date()
      });
    } else {
      res.json({
        title: statusPage.title,
        description: statusPage.description,
        logo_url: statusPage.logo_url,
        theme: statusPage.theme,
        overall_status: 'operational',
        monitors: [],
        recent_incidents: [],
        updated_at: new Date()
      });
    }
  } catch (error) {
    console.error('Get public status page error:', error);
    res.status(500).json({ error: 'Failed to fetch status page' });
  }
};

module.exports = {
  createStatusPage,
  getStatusPages,
  getStatusPage,
  updateStatusPage,
  deleteStatusPage,
  getPublicStatusPage
};
