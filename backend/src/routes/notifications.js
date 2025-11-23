const express = require('express');
const { body } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const { authMiddleware, organizationMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and organization access
router.use(authMiddleware);
router.use(organizationMiddleware);

// Create notification channel
router.post('/',
  requireRole(['owner', 'admin']),
  [
    body('name').trim().notEmpty(),
    body('type').isIn(['email', 'slack', 'discord', 'webhook', 'pagerduty']),
    body('config').isObject()
  ],
  notificationController.createChannel
);

// Get all channels
router.get('/', notificationController.getChannels);

// Update channel
router.patch('/:id',
  requireRole(['owner', 'admin']),
  notificationController.updateChannel
);

// Delete channel
router.delete('/:id',
  requireRole(['owner', 'admin']),
  notificationController.deleteChannel
);

// Test channel
router.post('/:id/test', notificationController.testChannel);

// Get notification log
router.get('/logs', notificationController.getNotificationLog);

module.exports = router;
