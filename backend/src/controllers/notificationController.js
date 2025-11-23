const { validationResult } = require('express-validator');
const db = require('../config/database');

const createChannel = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, type, config } = req.body;

    // Validate config based on type
    const validationError = validateChannelConfig(type, config);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { rows } = await db.query(
      `INSERT INTO notification_channels (organization_id, name, type, config, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.organization.id, name, type, JSON.stringify(config), req.user.id]
    );

    res.status(201).json({
      message: 'Notification channel created successfully',
      channel: rows[0]
    });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Failed to create notification channel' });
  }
};

const getChannels = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT nc.*, u.full_name as created_by_name
       FROM notification_channels nc
       LEFT JOIN users u ON u.id = nc.created_by
       WHERE nc.organization_id = $1
       ORDER BY nc.created_at DESC`,
      [req.organization.id]
    );

    res.json({ channels: rows });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Failed to fetch notification channels' });
  }
};

const updateChannel = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, config, is_active } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (config) {
      updates.push(`config = $${paramCount}`);
      values.push(JSON.stringify(config));
      paramCount++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id, req.organization.id);

    const { rows } = await db.query(
      `UPDATE notification_channels SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notification channel not found' });
    }

    res.json({
      message: 'Notification channel updated successfully',
      channel: rows[0]
    });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ error: 'Failed to update notification channel' });
  }
};

const deleteChannel = async (req, res) => {
  try {
    const { id } = req.params;

    const { rowCount } = await db.query(
      'DELETE FROM notification_channels WHERE id = $1 AND organization_id = $2',
      [id, req.organization.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Notification channel not found' });
    }

    res.json({ message: 'Notification channel deleted successfully' });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ error: 'Failed to delete notification channel' });
  }
};

const testChannel = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      'SELECT * FROM notification_channels WHERE id = $1 AND organization_id = $2',
      [id, req.organization.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notification channel not found' });
    }

    const channel = rows[0];
    const notificationService = require('../services/notificationService');

    await notificationService.sendToChannel(
      channel,
      'test',
      {
        monitorName: 'Test Monitor',
        monitorUrl: 'https://example.com',
        message: 'This is a test notification from PulseAPI'
      },
      req.organization.id
    );

    res.json({ message: 'Test notification sent successfully' });
  } catch (error) {
    console.error('Test channel error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
};

const getNotificationLog = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const { rows } = await db.query(
      `SELECT nl.*, nc.name as channel_name, nc.type as channel_type,
         m.name as monitor_name, i.title as incident_title
       FROM notification_log nl
       LEFT JOIN notification_channels nc ON nc.id = nl.notification_channel_id
       LEFT JOIN monitors m ON m.id = nl.monitor_id
       LEFT JOIN incidents i ON i.id = nl.incident_id
       WHERE nl.organization_id = $1
       ORDER BY nl.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.organization.id, limit, offset]
    );

    res.json({ logs: rows });
  } catch (error) {
    console.error('Get notification log error:', error);
    res.status(500).json({ error: 'Failed to fetch notification log' });
  }
};

/**
 * Validate channel configuration
 */
function validateChannelConfig(type, config) {
  switch (type) {
    case 'slack':
      if (!config.webhook_url) {
        return 'Slack webhook URL is required';
      }
      if (!config.webhook_url.startsWith('https://hooks.slack.com/')) {
        return 'Invalid Slack webhook URL';
      }
      break;

    case 'discord':
      if (!config.webhook_url) {
        return 'Discord webhook URL is required';
      }
      if (!config.webhook_url.includes('discord.com/api/webhooks/')) {
        return 'Invalid Discord webhook URL';
      }
      break;

    case 'webhook':
      if (!config.url) {
        return 'Webhook URL is required';
      }
      try {
        new URL(config.url);
      } catch {
        return 'Invalid webhook URL';
      }
      break;

    case 'email':
      if (!config.recipients || !Array.isArray(config.recipients) || config.recipients.length === 0) {
        return 'At least one recipient email is required';
      }
      for (const email of config.recipients) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return `Invalid email address: ${email}`;
        }
      }
      break;

    case 'pagerduty':
      if (!config.integration_key) {
        return 'PagerDuty integration key is required';
      }
      break;

    default:
      return `Unsupported notification type: ${type}`;
  }

  return null;
}

module.exports = {
  createChannel,
  getChannels,
  updateChannel,
  deleteChannel,
  testChannel,
  getNotificationLog
};
