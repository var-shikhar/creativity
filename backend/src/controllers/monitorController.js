const { validationResult } = require('express-validator');
const db = require('../config/database');
const monitorService = require('../services/monitorService');

const createMonitor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      url,
      method = 'GET',
      check_interval = 60000,
      timeout = 30000,
      headers = {},
      body,
      expected_status_codes = [200],
      regions = ['us-east']
    } = req.body;

    const { rows } = await db.query(
      `INSERT INTO monitors (
        organization_id, name, url, method, check_interval, timeout,
        headers, body, expected_status_codes, created_by, regions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        req.organization.id,
        name,
        url,
        method,
        check_interval,
        timeout,
        JSON.stringify(headers),
        body,
        expected_status_codes,
        req.user.id,
        regions
      ]
    );

    const monitor = rows[0];

    // Start monitoring this endpoint
    await monitorService.startMonitoring(monitor.id);

    res.status(201).json({
      message: 'Monitor created successfully',
      monitor
    });
  } catch (error) {
    console.error('Create monitor error:', error);
    res.status(500).json({ error: 'Failed to create monitor' });
  }
};

const getMonitors = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT m.*,
        (SELECT is_up FROM monitor_checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as current_status,
        (SELECT AVG(response_time)::int FROM monitor_checks WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '1 hour') as avg_response_time,
        (SELECT COUNT(*) FROM incidents WHERE monitor_id = m.id AND status = 'open') as open_incidents
       FROM monitors m
       WHERE m.organization_id = $1
       ORDER BY m.created_at DESC`,
      [req.organization.id]
    );

    res.json({ monitors: rows });
  } catch (error) {
    console.error('Get monitors error:', error);
    res.status(500).json({ error: 'Failed to fetch monitors' });
  }
};

const getMonitor = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT m.*,
        (SELECT is_up FROM monitor_checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1) as current_status
       FROM monitors m
       WHERE m.id = $1 AND m.organization_id = $2`,
      [id, req.organization.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Monitor not found' });
    }

    res.json({ monitor: rows[0] });
  } catch (error) {
    console.error('Get monitor error:', error);
    res.status(500).json({ error: 'Failed to fetch monitor' });
  }
};

const updateMonitor = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'name', 'url', 'method', 'check_interval', 'timeout',
      'headers', 'body', 'expected_status_codes', 'is_active', 'regions'
    ];

    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(['headers', 'expected_status_codes', 'regions'].includes(key) ? JSON.stringify(value) : value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id, req.organization.id);

    const { rows } = await db.query(
      `UPDATE monitors SET ${fields.join(', ')}
       WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Monitor not found' });
    }

    // Restart monitoring with new settings
    if (updates.is_active !== false) {
      await monitorService.restartMonitoring(rows[0].id);
    } else {
      await monitorService.stopMonitoring(rows[0].id);
    }

    res.json({
      message: 'Monitor updated successfully',
      monitor: rows[0]
    });
  } catch (error) {
    console.error('Update monitor error:', error);
    res.status(500).json({ error: 'Failed to update monitor' });
  }
};

const deleteMonitor = async (req, res) => {
  try {
    const { id } = req.params;

    // Stop monitoring
    await monitorService.stopMonitoring(id);

    const { rowCount } = await db.query(
      'DELETE FROM monitors WHERE id = $1 AND organization_id = $2',
      [id, req.organization.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Monitor not found' });
    }

    res.json({ message: 'Monitor deleted successfully' });
  } catch (error) {
    console.error('Delete monitor error:', error);
    res.status(500).json({ error: 'Failed to delete monitor' });
  }
};

const getMonitorStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '24h' } = req.query;

    const intervals = {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    };

    const interval = intervals[period] || '24 hours';

    // Get recent checks
    const checksResult = await db.query(
      `SELECT
        checked_at,
        response_time,
        is_up,
        status_code,
        region
       FROM monitor_checks
       WHERE monitor_id = $1 AND checked_at > NOW() - INTERVAL '${interval}'
       ORDER BY checked_at DESC
       LIMIT 1000`,
      [id]
    );

    // Calculate statistics
    const checks = checksResult.rows;
    const totalChecks = checks.length;
    const upChecks = checks.filter(c => c.is_up).length;
    const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;

    const responseTimes = checks.filter(c => c.response_time).map(c => c.response_time).sort((a, b) => a - b);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

    // Get incidents in period
    const incidentsResult = await db.query(
      `SELECT COUNT(*) as count, severity
       FROM incidents
       WHERE monitor_id = $1 AND started_at > NOW() - INTERVAL '${interval}'
       GROUP BY severity`,
      [id]
    );

    res.json({
      period,
      statistics: {
        total_checks: totalChecks,
        uptime_percentage: Math.round(uptimePercentage * 100) / 100,
        average_response_time: Math.round(avgResponseTime),
        p50_response_time: p50,
        p95_response_time: p95,
        p99_response_time: p99
      },
      checks: checks.slice(0, 100),
      incidents: incidentsResult.rows
    });
  } catch (error) {
    console.error('Get monitor stats error:', error);
    res.status(500).json({ error: 'Failed to fetch monitor statistics' });
  }
};

module.exports = {
  createMonitor,
  getMonitors,
  getMonitor,
  updateMonitor,
  deleteMonitor,
  getMonitorStats
};
