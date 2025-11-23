const axios = require('axios');
const https = require('https');
const tls = require('tls');
const db = require('../config/database');
const { performance } = require('perf_hooks');
const notificationService = require('./notificationService');

// Store active monitoring intervals
const activeMonitors = new Map();

const performCheck = async (monitor) => {
  const startTime = performance.now();
  let checkResult = {
    monitor_id: monitor.id,
    is_up: false,
    checked_at: new Date(),
    region: 'us-east' // Default region
  };

  try {
    const config = {
      method: monitor.method.toLowerCase(),
      url: monitor.url,
      timeout: monitor.timeout,
      validateStatus: () => true, // Don't throw on any status code
      headers: monitor.headers || {}
    };

    if (monitor.body && ['post', 'put', 'patch'].includes(config.method)) {
      config.data = monitor.body;
    }

    const dnsStart = performance.now();
    const response = await axios(config);
    const totalTime = performance.now() - startTime;

    checkResult = {
      ...checkResult,
      status_code: response.status,
      response_time: Math.round(totalTime),
      is_up: (monitor.expected_status_codes || [200]).includes(response.status),
      response_size: JSON.stringify(response.data).length,
      dns_time: Math.round(performance.now() - dnsStart),
      first_byte_time: Math.round(totalTime * 0.3) // Approximation
    };

    // Check SSL certificate if HTTPS
    if (monitor.url.startsWith('https://') && monitor.ssl_check_enabled !== false) {
      const sslInfo = await checkSSL(monitor.url);
      checkResult.ssl_valid = sslInfo.valid;
      checkResult.ssl_expires_at = sslInfo.expiresAt;

      // Check SSL expiry threshold
      if (sslInfo.daysUntilExpiry !== null && sslInfo.daysUntilExpiry <= (monitor.ssl_expiry_threshold || 30)) {
        await notificationService.sendNotification(monitor.organization_id, 'ssl_expiring', {
          monitorId: monitor.id,
          monitorName: monitor.name,
          monitorUrl: monitor.url,
          daysUntilExpiry: sslInfo.daysUntilExpiry,
          expiryDate: sslInfo.expiresAt
        });
      }
    }

    // Validate response assertions
    if (monitor.assertions && monitor.assertions.length > 0) {
      const assertionResults = validateAssertions(response.data, monitor.assertions);
      if (!assertionResults.passed) {
        checkResult.is_up = false;
        checkResult.error = `Assertion failed: ${assertionResults.failedAssertion}`;
      }
    }
  } catch (error) {
    const totalTime = performance.now() - startTime;

    checkResult = {
      ...checkResult,
      error: error.message,
      response_time: Math.round(totalTime),
      is_up: false
    };
  }

  // Save check result
  try {
    await db.query(
      `INSERT INTO monitor_checks (
        monitor_id, status_code, response_time, error, is_up,
        checked_at, region, ssl_valid, response_size, dns_time, first_byte_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        checkResult.monitor_id,
        checkResult.status_code,
        checkResult.response_time,
        checkResult.error,
        checkResult.is_up,
        checkResult.checked_at,
        checkResult.region,
        checkResult.ssl_valid,
        checkResult.response_size,
        checkResult.dns_time,
        checkResult.first_byte_time
      ]
    );

    // Check if we need to create an incident
    await checkForIncident(monitor, checkResult);

    // Emit WebSocket event (will be handled by WebSocket service)
    global.io?.to(`org-${monitor.organization_id}`).emit('monitor:check', {
      monitorId: monitor.id,
      ...checkResult
    });
  } catch (dbError) {
    console.error('Failed to save check result:', dbError);
  }

  return checkResult;
};

const checkForIncident = async (monitor, checkResult) => {
  try {
    // Get the last few checks to determine if this is a pattern
    const { rows: recentChecks } = await db.query(
      `SELECT is_up FROM monitor_checks
       WHERE monitor_id = $1
       ORDER BY checked_at DESC
       LIMIT 3`,
      [monitor.id]
    );

    // If all recent checks are down, create/update incident
    const allDown = recentChecks.length >= 2 && recentChecks.every(c => !c.is_up);

    if (allDown) {
      // Check if there's an open incident
      const { rows: openIncidents } = await db.query(
        `SELECT id FROM incidents
         WHERE monitor_id = $1 AND status IN ('open', 'investigating')
         ORDER BY started_at DESC
         LIMIT 1`,
        [monitor.id]
      );

      if (openIncidents.length === 0) {
        // Create new incident
        const { rows: [incident] } = await db.query(
          `INSERT INTO incidents (
            monitor_id, organization_id, title, description, severity, status
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id`,
          [
            monitor.id,
            monitor.organization_id,
            `${monitor.name} is down`,
            `Monitor has failed ${recentChecks.length} consecutive health checks. Last error: ${checkResult.error || 'Unexpected status code'}`,
            'high',
            'open'
          ]
        );

        // Send notifications
        await notificationService.sendNotification(monitor.organization_id, 'incident_created', {
          incidentId: incident.id,
          monitorId: monitor.id,
          monitorName: monitor.name,
          monitorUrl: monitor.url,
          error: checkResult.error,
          severity: 'high'
        });

        // Emit incident created event
        global.io?.to(`org-${monitor.organization_id}`).emit('incident:created', {
          monitorId: monitor.id,
          monitorName: monitor.name
        });
      }
    } else if (checkResult.is_up) {
      // Check if we need to resolve an incident
      const { rows: openIncidents } = await db.query(
        `SELECT id FROM incidents
         WHERE monitor_id = $1 AND status IN ('open', 'investigating')
         ORDER BY started_at DESC
         LIMIT 1`,
        [monitor.id]
      );

      if (openIncidents.length > 0) {
        await db.query(
          `UPDATE incidents
           SET status = 'resolved', resolved_at = NOW()
           WHERE id = $1`,
          [openIncidents[0].id]
        );

        // Emit incident resolved event
        global.io?.to(`org-${monitor.organization_id}`).emit('incident:resolved', {
          monitorId: monitor.id,
          monitorName: monitor.name,
          incidentId: openIncidents[0].id
        });
      }
    }
  } catch (error) {
    console.error('Error checking for incident:', error);
  }
};

const startMonitoring = async (monitorId) => {
  try {
    // Get monitor details
    const { rows } = await db.query(
      'SELECT * FROM monitors WHERE id = $1 AND is_active = true',
      [monitorId]
    );

    if (rows.length === 0) {
      return;
    }

    const monitor = rows[0];

    // Stop existing monitoring if any
    if (activeMonitors.has(monitorId)) {
      clearInterval(activeMonitors.get(monitorId));
    }

    // Perform initial check
    await performCheck(monitor);

    // Set up recurring checks
    const interval = setInterval(async () => {
      try {
        await performCheck(monitor);
      } catch (error) {
        console.error(`Error checking monitor ${monitorId}:`, error);
      }
    }, monitor.check_interval);

    activeMonitors.set(monitorId, interval);

    console.log(`✓ Started monitoring: ${monitor.name} (every ${monitor.check_interval}ms)`);
  } catch (error) {
    console.error('Error starting monitoring:', error);
  }
};

const stopMonitoring = (monitorId) => {
  if (activeMonitors.has(monitorId)) {
    clearInterval(activeMonitors.get(monitorId));
    activeMonitors.delete(monitorId);
    console.log(`✓ Stopped monitoring: ${monitorId}`);
  }
};

const restartMonitoring = async (monitorId) => {
  stopMonitoring(monitorId);
  await startMonitoring(monitorId);
};

const initializeAllMonitors = async () => {
  try {
    console.log('🔄 Initializing all active monitors...');

    const { rows } = await db.query(
      'SELECT id FROM monitors WHERE is_active = true'
    );

    for (const monitor of rows) {
      await startMonitoring(monitor.id);
    }

    console.log(`✓ Initialized ${rows.length} monitors`);
  } catch (error) {
    console.error('Error initializing monitors:', error);
  }
};

// Calculate daily statistics
const calculateDailyStats = async () => {
  try {
    const { rows: monitors } = await db.query('SELECT id FROM monitors');

    for (const monitor of monitors) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Check if stats already exist
      const { rows: existing } = await db.query(
        'SELECT id FROM monitor_statistics WHERE monitor_id = $1 AND date = $2',
        [monitor.id, yesterdayStr]
      );

      if (existing.length > 0) {
        continue;
      }

      // Calculate stats for yesterday
      const { rows: stats } = await db.query(
        `SELECT
          COUNT(*) as total_checks,
          COUNT(*) FILTER (WHERE is_up = true) as successful_checks,
          COUNT(*) FILTER (WHERE is_up = false) as failed_checks,
          AVG(response_time) FILTER (WHERE is_up = true) as avg_response_time,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time) as p50,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99
         FROM monitor_checks
         WHERE monitor_id = $1
           AND checked_at >= $2::date
           AND checked_at < $2::date + interval '1 day'`,
        [monitor.id, yesterdayStr]
      );

      if (stats.length > 0 && stats[0].total_checks > 0) {
        const stat = stats[0];
        const uptimePercentage = (parseInt(stat.successful_checks) / parseInt(stat.total_checks)) * 100;

        await db.query(
          `INSERT INTO monitor_statistics (
            monitor_id, date, uptime_percentage, avg_response_time,
            p50_response_time, p95_response_time, p99_response_time,
            total_checks, successful_checks, failed_checks
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            monitor.id,
            yesterdayStr,
            Math.round(uptimePercentage * 100) / 100,
            Math.round(stat.avg_response_time || 0),
            Math.round(stat.p50 || 0),
            Math.round(stat.p95 || 0),
            Math.round(stat.p99 || 0),
            stat.total_checks,
            stat.successful_checks,
            stat.failed_checks
          ]
        );
      }
    }

    console.log('✓ Daily statistics calculated');
  } catch (error) {
    console.error('Error calculating daily stats:', error);
  }
};

/**
 * Check SSL certificate validity and expiry
 */
const checkSSL = async (url) => {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const options = {
        host: urlObj.hostname,
        port: urlObj.port || 443,
        method: 'GET',
        rejectUnauthorized: false // We want to check even invalid certs
      };

      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();

        if (!cert || Object.keys(cert).length === 0) {
          return resolve({ valid: false, expiresAt: null, daysUntilExpiry: null });
        }

        const expiryDate = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));

        resolve({
          valid: now < expiryDate,
          expiresAt: cert.valid_to,
          daysUntilExpiry,
          issuer: cert.issuer,
          subject: cert.subject
        });
      });

      req.on('error', () => {
        resolve({ valid: false, expiresAt: null, daysUntilExpiry: null });
      });

      req.end();
    } catch (error) {
      resolve({ valid: false, expiresAt: null, daysUntilExpiry: null });
    }
  });
};

/**
 * Validate response assertions
 */
const validateAssertions = (responseData, assertions) => {
  for (const assertion of assertions) {
    const { type, property, operator, value } = assertion;

    let actualValue;

    // Extract value from response
    if (property) {
      const keys = property.split('.');
      actualValue = keys.reduce((obj, key) => obj?.[key], responseData);
    } else {
      actualValue = responseData;
    }

    // Perform comparison based on operator
    let passed = false;

    switch (operator) {
      case 'equals':
        passed = actualValue == value;
        break;
      case 'not_equals':
        passed = actualValue != value;
        break;
      case 'contains':
        passed = String(actualValue).includes(value);
        break;
      case 'not_contains':
        passed = !String(actualValue).includes(value);
        break;
      case 'greater_than':
        passed = Number(actualValue) > Number(value);
        break;
      case 'less_than':
        passed = Number(actualValue) < Number(value);
        break;
      case 'exists':
        passed = actualValue !== undefined && actualValue !== null;
        break;
      case 'not_exists':
        passed = actualValue === undefined || actualValue === null;
        break;
      default:
        passed = true;
    }

    if (!passed) {
      return {
        passed: false,
        failedAssertion: `${property || 'response'} ${operator} ${value} (got: ${JSON.stringify(actualValue)})`
      };
    }
  }

  return { passed: true };
};

/**
 * Check if monitor is in maintenance window
 */
const isInMaintenanceWindow = async (monitorId, organizationId) => {
  const now = new Date();

  const { rows } = await db.query(
    `SELECT id FROM maintenance_windows
     WHERE organization_id = $1
       AND (monitor_ids = ARRAY[]::UUID[] OR $2 = ANY(monitor_ids))
       AND start_time <= $3
       AND end_time >= $3`,
    [organizationId, monitorId, now]
  );

  return rows.length > 0;
};

module.exports = {
  startMonitoring,
  stopMonitoring,
  restartMonitoring,
  initializeAllMonitors,
  performCheck,
  calculateDailyStats,
  checkSSL,
  validateAssertions,
  isInMaintenanceWindow
};
