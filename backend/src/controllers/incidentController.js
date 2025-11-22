const db = require('../config/database');

const getIncidents = async (req, res) => {
  try {
    const { status, severity } = req.query;

    let query = `
      SELECT i.*,
        m.name as monitor_name,
        m.url as monitor_url,
        u1.full_name as acknowledged_by_name,
        u2.full_name as resolved_by_name
      FROM incidents i
      JOIN monitors m ON m.id = i.monitor_id
      LEFT JOIN users u1 ON u1.id = i.acknowledged_by
      LEFT JOIN users u2 ON u2.id = i.resolved_by
      WHERE i.organization_id = $1
    `;

    const params = [req.organization.id];
    let paramCount = 2;

    if (status) {
      query += ` AND i.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (severity) {
      query += ` AND i.severity = $${paramCount}`;
      params.push(severity);
      paramCount++;
    }

    query += ' ORDER BY i.started_at DESC LIMIT 100';

    const { rows } = await db.query(query, params);

    res.json({ incidents: rows });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
};

const getIncident = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT i.*,
        m.name as monitor_name,
        m.url as monitor_url,
        u1.full_name as acknowledged_by_name,
        u2.full_name as resolved_by_name
       FROM incidents i
       JOIN monitors m ON m.id = i.monitor_id
       LEFT JOIN users u1 ON u1.id = i.acknowledged_by
       LEFT JOIN users u2 ON u2.id = i.resolved_by
       WHERE i.id = $1 AND i.organization_id = $2`,
      [id, req.organization.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Get incident updates
    const updatesResult = await db.query(
      `SELECT iu.*, u.full_name as user_name
       FROM incident_updates iu
       LEFT JOIN users u ON u.id = iu.user_id
       WHERE iu.incident_id = $1
       ORDER BY iu.created_at ASC`,
      [id]
    );

    res.json({
      incident: rows[0],
      updates: updatesResult.rows
    });
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
};

const updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, severity, message } = req.body;

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const updates = [];
      const values = [];
      let paramCount = 1;

      if (status) {
        updates.push(`status = $${paramCount}`);
        values.push(status);
        paramCount++;

        if (status === 'investigating' && !req.body.acknowledged_at) {
          updates.push(`acknowledged_at = NOW(), acknowledged_by = $${paramCount}`);
          values.push(req.user.id);
          paramCount++;
        }

        if (status === 'resolved' && !req.body.resolved_at) {
          updates.push(`resolved_at = NOW(), resolved_by = $${paramCount}`);
          values.push(req.user.id);
          paramCount++;
        }
      }

      if (severity) {
        updates.push(`severity = $${paramCount}`);
        values.push(severity);
        paramCount++;
      }

      if (updates.length > 0) {
        values.push(id, req.organization.id);

        const { rows } = await client.query(
          `UPDATE incidents SET ${updates.join(', ')}
           WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
           RETURNING *`,
          values
        );

        if (rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Incident not found' });
        }

        // Add update message
        if (message) {
          await client.query(
            `INSERT INTO incident_updates (incident_id, user_id, message, status)
             VALUES ($1, $2, $3, $4)`,
            [id, req.user.id, message, status]
          );
        }

        await client.query('COMMIT');

        // Emit WebSocket event
        global.io?.to(`org-${req.organization.id}`).emit('incident:updated', {
          incidentId: id,
          status,
          severity
        });

        res.json({
          message: 'Incident updated successfully',
          incident: rows[0]
        });
      } else {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'No valid fields to update' });
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
};

const addIncidentUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Verify incident belongs to organization
    const { rows: incidents } = await db.query(
      'SELECT id FROM incidents WHERE id = $1 AND organization_id = $2',
      [id, req.organization.id]
    );

    if (incidents.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const { rows } = await db.query(
      `INSERT INTO incident_updates (incident_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, req.user.id, message]
    );

    // Emit WebSocket event
    global.io?.to(`org-${req.organization.id}`).emit('incident:update_added', {
      incidentId: id,
      update: rows[0]
    });

    res.status(201).json({
      message: 'Update added successfully',
      update: rows[0]
    });
  } catch (error) {
    console.error('Add incident update error:', error);
    res.status(500).json({ error: 'Failed to add update' });
  }
};

const getIncidentStats = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'investigating') as investigating_count,
        COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at > NOW() - INTERVAL '24 hours') as resolved_24h,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
        AVG(EXTRACT(EPOCH FROM (resolved_at - started_at))) FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_time
       FROM incidents
       WHERE organization_id = $1
         AND started_at > NOW() - INTERVAL '30 days'`,
      [req.organization.id]
    );

    res.json({ statistics: rows[0] });
  } catch (error) {
    console.error('Get incident stats error:', error);
    res.status(500).json({ error: 'Failed to fetch incident statistics' });
  }
};

module.exports = {
  getIncidents,
  getIncident,
  updateIncident,
  addIncidentUpdate,
  getIncidentStats
};
