const express = require('express');
const { body } = require('express-validator');
const teamController = require('../controllers/teamController');
const { authMiddleware, organizationMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Accept invitation (no org middleware needed)
router.post('/invitations/accept',
  authMiddleware,
  [body('token').notEmpty()],
  teamController.acceptInvitation
);

// All other routes require authentication and organization access
router.use(authMiddleware);
router.use(organizationMiddleware);

// Invite team member
router.post('/invite',
  requireRole(['owner', 'admin']),
  [
    body('email').isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'member'])
  ],
  teamController.inviteTeamMember
);

// Get pending invitations
router.get('/invitations',
  requireRole(['owner', 'admin']),
  teamController.getPendingInvitations
);

// Revoke invitation
router.delete('/invitations/:id',
  requireRole(['owner', 'admin']),
  teamController.revokeInvitation
);

// Get team members
router.get('/members', teamController.getTeamMembers);

// Update member role
router.patch('/members/:userId/role',
  requireRole(['owner', 'admin']),
  [body('role').isIn(['admin', 'member'])],
  teamController.updateMemberRole
);

// Remove team member
router.delete('/members/:userId',
  requireRole(['owner', 'admin']),
  teamController.removeMember
);

module.exports = router;
