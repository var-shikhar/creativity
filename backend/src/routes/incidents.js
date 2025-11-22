const express = require('express');
const { body } = require('express-validator');
const incidentController = require('../controllers/incidentController');
const { authMiddleware, organizationMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and organization access
router.use(authMiddleware);
router.use(organizationMiddleware);

// Get all incidents
router.get('/', incidentController.getIncidents);

// Get incident statistics
router.get('/stats', incidentController.getIncidentStats);

// Get incident by ID
router.get('/:id', incidentController.getIncident);

// Update incident
router.patch('/:id',
  [
    body('status').optional().isIn(['open', 'investigating', 'resolved', 'closed']),
    body('severity').optional().isIn(['low', 'medium', 'high', 'critical'])
  ],
  incidentController.updateIncident
);

// Add update to incident
router.post('/:id/updates',
  [body('message').trim().notEmpty()],
  incidentController.addIncidentUpdate
);

module.exports = router;
