const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const monitorRoutes = require('./routes/monitors');
const incidentRoutes = require('./routes/incidents');
const notificationRoutes = require('./routes/notifications');
const teamRoutes = require('./routes/team');
const statusPageRoutes = require('./routes/statusPages');

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations/:orgId/monitors', monitorRoutes);
app.use('/api/organizations/:orgId/incidents', incidentRoutes);
app.use('/api/organizations/:orgId/notifications', notificationRoutes);
app.use('/api/organizations/:orgId/team', teamRoutes);
app.use('/api/organizations/:orgId/status-pages', statusPageRoutes);
app.use('/api/status', statusPageRoutes); // Public status page endpoint

// Dashboard stats endpoint
app.get('/api/organizations/:orgId/dashboard', async (req, res) => {
  try {
    const db = require('./config/database');
    const { orgId } = req.params;

    const [monitors, incidents, recentChecks] = await Promise.all([
      db.query(`
        SELECT COUNT(*) as total,
               COUNT(*) FILTER (WHERE is_active = true) as active
        FROM monitors
        WHERE organization_id = $1
      `, [orgId]),

      db.query(`
        SELECT COUNT(*) as total,
               COUNT(*) FILTER (WHERE status = 'open') as open,
               COUNT(*) FILTER (WHERE status = 'investigating') as investigating
        FROM incidents
        WHERE organization_id = $1
          AND started_at > NOW() - INTERVAL '30 days'
      `, [orgId]),

      db.query(`
        SELECT
          m.name,
          m.id,
          mc.is_up,
          mc.response_time,
          mc.checked_at
        FROM monitor_checks mc
        JOIN monitors m ON m.id = mc.monitor_id
        WHERE m.organization_id = $1
          AND mc.checked_at > NOW() - INTERVAL '1 hour'
        ORDER BY mc.checked_at DESC
        LIMIT 50
      `, [orgId])
    ]);

    res.json({
      monitors: monitors.rows[0],
      incidents: incidents.rows[0],
      recentChecks: recentChecks.rows
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
