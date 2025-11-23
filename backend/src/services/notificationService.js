const axios = require('axios');
const db = require('../config/database');

class NotificationService {
  /**
   * Send notification through configured channels
   */
  async sendNotification(organizationId, type, data) {
    try {
      // Get active notification channels for the organization
      const { rows: channels } = await db.query(
        `SELECT * FROM notification_channels
         WHERE organization_id = $1 AND is_active = true`,
        [organizationId]
      );

      const promises = channels.map(channel =>
        this.sendToChannel(channel, type, data, organizationId)
      );

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  /**
   * Send to specific channel
   */
  async sendToChannel(channel, type, data, organizationId) {
    const logEntry = {
      organization_id: organizationId,
      notification_channel_id: channel.id,
      type,
      message: this.formatMessage(type, data),
      status: 'pending'
    };

    if (data.incidentId) logEntry.incident_id = data.incidentId;
    if (data.monitorId) logEntry.monitor_id = data.monitorId;

    try {
      switch (channel.type) {
        case 'slack':
          await this.sendSlack(channel.config, type, data);
          break;
        case 'discord':
          await this.sendDiscord(channel.config, type, data);
          break;
        case 'webhook':
          await this.sendWebhook(channel.config, type, data);
          break;
        case 'email':
          await this.sendEmail(channel.config, type, data);
          break;
        case 'pagerduty':
          await this.sendPagerDuty(channel.config, type, data);
          break;
        default:
          throw new Error(`Unsupported channel type: ${channel.type}`);
      }

      // Log success
      await db.query(
        `INSERT INTO notification_log
         (organization_id, notification_channel_id, incident_id, monitor_id, type, message, status, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          logEntry.organization_id,
          logEntry.notification_channel_id,
          logEntry.incident_id || null,
          logEntry.monitor_id || null,
          logEntry.type,
          logEntry.message,
          'sent'
        ]
      );

      console.log(`✓ Notification sent via ${channel.type}: ${channel.name}`);
    } catch (error) {
      console.error(`✗ Failed to send notification via ${channel.type}:`, error.message);

      // Log failure
      await db.query(
        `INSERT INTO notification_log
         (organization_id, notification_channel_id, incident_id, monitor_id, type, message, status, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          logEntry.organization_id,
          logEntry.notification_channel_id,
          logEntry.incident_id || null,
          logEntry.monitor_id || null,
          logEntry.type,
          logEntry.message,
          'failed',
          error.message
        ]
      );
    }
  }

  /**
   * Send Slack notification
   */
  async sendSlack(config, type, data) {
    const color = this.getColor(type);
    const emoji = this.getEmoji(type);

    const payload = {
      username: 'PulseAPI',
      icon_emoji: ':robot_face:',
      attachments: [{
        color,
        title: `${emoji} ${this.getTitle(type, data)}`,
        text: this.getMessage(type, data),
        fields: this.getFields(type, data),
        footer: 'PulseAPI',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    await axios.post(config.webhook_url, payload);
  }

  /**
   * Send Discord notification
   */
  async sendDiscord(config, type, data) {
    const color = this.getColorInt(type);
    const emoji = this.getEmoji(type);

    const payload = {
      username: 'PulseAPI',
      embeds: [{
        color,
        title: `${emoji} ${this.getTitle(type, data)}`,
        description: this.getMessage(type, data),
        fields: this.getFields(type, data).map(f => ({
          name: f.title,
          value: f.value,
          inline: f.short || false
        })),
        footer: {
          text: 'PulseAPI'
        },
        timestamp: new Date().toISOString()
      }]
    };

    await axios.post(config.webhook_url, payload);
  }

  /**
   * Send generic webhook
   */
  async sendWebhook(config, type, data) {
    const payload = {
      event: type,
      timestamp: new Date().toISOString(),
      data
    };

    const headers = {
      'Content-Type': 'application/json'
    };

    if (config.secret) {
      headers['X-PulseAPI-Signature'] = this.generateSignature(payload, config.secret);
    }

    await axios.post(config.url, payload, { headers });
  }

  /**
   * Send email notification
   */
  async sendEmail(config, type, data) {
    // This is a placeholder - in production, integrate with SendGrid, AWS SES, etc.
    console.log('Email notification:', {
      to: config.recipients,
      subject: this.getTitle(type, data),
      body: this.getMessage(type, data)
    });

    // TODO: Implement actual email sending
    // Example with nodemailer or SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({ to: config.recipients, from: 'noreply@pulseapi.dev', ... });
  }

  /**
   * Send PagerDuty notification
   */
  async sendPagerDuty(config, type, data) {
    const severity = this.getPagerDutySeverity(type, data);

    const payload = {
      routing_key: config.integration_key,
      event_action: type.includes('resolved') ? 'resolve' : 'trigger',
      dedup_key: data.incidentId || data.monitorId,
      payload: {
        summary: this.getTitle(type, data),
        severity,
        source: 'PulseAPI',
        custom_details: data
      }
    };

    await axios.post('https://events.pagerduty.com/v2/enqueue', payload);
  }

  /**
   * Helper methods
   */
  formatMessage(type, data) {
    return `${this.getTitle(type, data)} - ${this.getMessage(type, data)}`;
  }

  getTitle(type, data) {
    switch (type) {
      case 'incident_created':
        return `🚨 Incident: ${data.monitorName} is DOWN`;
      case 'incident_resolved':
        return `✅ Resolved: ${data.monitorName} is UP`;
      case 'ssl_expiring':
        return `⚠️ SSL Certificate Expiring: ${data.monitorName}`;
      case 'ssl_expired':
        return `❌ SSL Certificate Expired: ${data.monitorName}`;
      case 'monitor_slow':
        return `⏱️ Performance Issue: ${data.monitorName}`;
      default:
        return `PulseAPI Alert: ${data.monitorName}`;
    }
  }

  getMessage(type, data) {
    switch (type) {
      case 'incident_created':
        return `Monitor "${data.monitorName}" has failed health checks. Response: ${data.error || 'Timeout'}`;
      case 'incident_resolved':
        return `Monitor "${data.monitorName}" is back online and healthy. Downtime: ${data.downtime || 'Unknown'}`;
      case 'ssl_expiring':
        return `SSL certificate for "${data.monitorName}" expires in ${data.daysUntilExpiry} days.`;
      case 'ssl_expired':
        return `SSL certificate for "${data.monitorName}" has expired!`;
      case 'monitor_slow':
        return `Monitor "${data.monitorName}" response time (${data.responseTime}ms) is above threshold (${data.threshold}ms)`;
      default:
        return JSON.stringify(data);
    }
  }

  getFields(type, data) {
    const fields = [
      {
        title: 'Monitor',
        value: data.monitorName || 'N/A',
        short: true
      },
      {
        title: 'URL',
        value: data.monitorUrl || 'N/A',
        short: true
      }
    ];

    if (type === 'incident_created' || type === 'incident_resolved') {
      fields.push({
        title: 'Status',
        value: type === 'incident_created' ? 'DOWN' : 'UP',
        short: true
      });

      if (data.responseTime) {
        fields.push({
          title: 'Response Time',
          value: `${data.responseTime}ms`,
          short: true
        });
      }
    }

    if (type === 'ssl_expiring' || type === 'ssl_expired') {
      fields.push({
        title: 'Expiry Date',
        value: data.expiryDate || 'Unknown',
        short: true
      });
    }

    return fields;
  }

  getColor(type) {
    switch (type) {
      case 'incident_created':
      case 'ssl_expired':
        return 'danger';
      case 'incident_resolved':
        return 'good';
      case 'ssl_expiring':
      case 'monitor_slow':
        return 'warning';
      default:
        return '#808080';
    }
  }

  getColorInt(type) {
    switch (type) {
      case 'incident_created':
      case 'ssl_expired':
        return 15158332; // Red
      case 'incident_resolved':
        return 3066993; // Green
      case 'ssl_expiring':
      case 'monitor_slow':
        return 15844367; // Yellow
      default:
        return 8421504; // Gray
    }
  }

  getEmoji(type) {
    switch (type) {
      case 'incident_created':
        return '🚨';
      case 'incident_resolved':
        return '✅';
      case 'ssl_expiring':
        return '⚠️';
      case 'ssl_expired':
        return '❌';
      case 'monitor_slow':
        return '⏱️';
      default:
        return '📊';
    }
  }

  getPagerDutySeverity(type, data) {
    switch (type) {
      case 'incident_created':
        return data.severity === 'critical' ? 'critical' : 'error';
      case 'ssl_expired':
        return 'critical';
      case 'ssl_expiring':
      case 'monitor_slow':
        return 'warning';
      default:
        return 'info';
    }
  }

  generateSignature(payload, secret) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }
}

module.exports = new NotificationService();
