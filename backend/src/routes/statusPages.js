const express = require('express');
const { body } = require('express-validator');
const statusPageController = require('../controllers/statusPageController');
const { authMiddleware, organizationMiddleware } = require('../middleware/auth');

const router = express.Router();

// Public endpoint (no auth required)
router.get('/public/:subdomain', statusPageController.getPublicStatusPage);

// All other routes require authentication and organization access
router.use(authMiddleware);
router.use(organizationMiddleware);

// Create status page
router.post('/',
  [
    body('subdomain').trim().notEmpty().matches(/^[a-z0-9-]+$/),
    body('title').trim().notEmpty(),
    body('monitors').optional().isArray()
  ],
  statusPageController.createStatusPage
);

// Get all status pages
router.get('/', statusPageController.getStatusPages);

// Get status page by ID
router.get('/:id', statusPageController.getStatusPage);

// Update status page
router.patch('/:id', statusPageController.updateStatusPage);

// Delete status page
router.delete('/:id', statusPageController.deleteStatusPage);

module.exports = router;
