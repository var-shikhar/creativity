const express = require('express');
const { body } = require('express-validator');
const monitorController = require('../controllers/monitorController');
const { authMiddleware, organizationMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and organization access
router.use(authMiddleware);
router.use(organizationMiddleware);

// Create monitor
router.post('/',
  [
    body('name').trim().notEmpty(),
    body('url').isURL(),
    body('method').optional().isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']),
    body('check_interval').optional().isInt({ min: 30000, max: 86400000 })
  ],
  monitorController.createMonitor
);

// Get all monitors
router.get('/', monitorController.getMonitors);

// Get monitor by ID
router.get('/:id', monitorController.getMonitor);

// Update monitor
router.patch('/:id', monitorController.updateMonitor);

// Delete monitor
router.delete('/:id', monitorController.deleteMonitor);

// Get monitor statistics
router.get('/:id/stats', monitorController.getMonitorStats);

module.exports = router;
