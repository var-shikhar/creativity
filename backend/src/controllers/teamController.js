const crypto = require('crypto');
const { validationResult } = require('express-validator');
const db = require('../config/database');

const inviteTeamMember = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, role = 'member' } = req.body;

    // Check if user already exists in organization
    const { rows: existing } = await db.query(
      `SELECT uo.id FROM user_organizations uo
       JOIN users u ON u.id = uo.user_id
       WHERE u.email = $1 AND uo.organization_id = $2`,
      [email, req.organization.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this organization' });
    }

    // Check for pending invitation
    const { rows: pendingInvites } = await db.query(
      `SELECT id FROM team_invitations
       WHERE email = $1 AND organization_id = $2 AND accepted_at IS NULL AND expires_at > NOW()`,
      [email, req.organization.id]
    );

    if (pendingInvites.length > 0) {
      return res.status(400).json({ error: 'Invitation already sent to this email' });
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const { rows } = await db.query(
      `INSERT INTO team_invitations (organization_id, email, role, invited_by, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.organization.id, email, role, req.user.id, token, expiresAt]
    );

    // TODO: Send invitation email
    // const invitationUrl = `${process.env.FRONTEND_URL}/accept-invitation?token=${token}`;
    // await emailService.sendInvitation(email, invitationUrl);

    res.status(201).json({
      message: 'Team invitation sent successfully',
      invitation: {
        ...rows[0],
        invitation_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`
      }
    });
  } catch (error) {
    console.error('Invite team member error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
};

const getPendingInvitations = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ti.*, u.full_name as invited_by_name
       FROM team_invitations ti
       JOIN users u ON u.id = ti.invited_by
       WHERE ti.organization_id = $1 AND ti.accepted_at IS NULL AND ti.expires_at > NOW()
       ORDER BY ti.created_at DESC`,
      [req.organization.id]
    );

    res.json({ invitations: rows });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
};

const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    // Get invitation
    const { rows: invitations } = await db.query(
      `SELECT * FROM team_invitations
       WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
      [token]
    );

    if (invitations.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const invitation = invitations[0];

    // Check if user email matches invitation
    if (req.user.email !== invitation.email) {
      return res.status(403).json({
        error: 'This invitation is for a different email address',
        expected_email: invitation.email
      });
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Add user to organization
      await client.query(
        `INSERT INTO user_organizations (user_id, organization_id, role)
         VALUES ($1, $2, $3)`,
        [req.user.id, invitation.organization_id, invitation.role]
      );

      // Mark invitation as accepted
      await client.query(
        'UPDATE team_invitations SET accepted_at = NOW() WHERE id = $1',
        [invitation.id]
      );

      await client.query('COMMIT');

      // Get organization details
      const { rows: orgs } = await client.query(
        'SELECT * FROM organizations WHERE id = $1',
        [invitation.organization_id]
      );

      res.json({
        message: 'Invitation accepted successfully',
        organization: orgs[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
};

const revokeInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    const { rowCount } = await db.query(
      'DELETE FROM team_invitations WHERE id = $1 AND organization_id = $2',
      [id, req.organization.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    res.json({ message: 'Invitation revoked successfully' });
  } catch (error) {
    console.error('Revoke invitation error:', error);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
};

const getTeamMembers = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.full_name, u.created_at, u.last_login,
         uo.role, uo.joined_at
       FROM user_organizations uo
       JOIN users u ON u.id = uo.user_id
       WHERE uo.organization_id = $1
       ORDER BY uo.joined_at ASC`,
      [req.organization.id]
    );

    res.json({ members: rows });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
};

const updateMemberRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin or member' });
    }

    // Prevent modifying owner
    const { rows: members } = await db.query(
      'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
      [userId, req.organization.id]
    );

    if (members.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    if (members[0].role === 'owner') {
      return res.status(403).json({ error: 'Cannot modify owner role' });
    }

    await db.query(
      'UPDATE user_organizations SET role = $1 WHERE user_id = $2 AND organization_id = $3',
      [role, userId, req.organization.id]
    );

    res.json({ message: 'Member role updated successfully' });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
};

const removeMember = async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent removing owner
    const { rows: members } = await db.query(
      'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
      [userId, req.organization.id]
    );

    if (members.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    if (members[0].role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove owner from organization' });
    }

    await db.query(
      'DELETE FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
      [userId, req.organization.id]
    );

    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
};

module.exports = {
  inviteTeamMember,
  getPendingInvitations,
  acceptInvitation,
  revokeInvitation,
  getTeamMembers,
  updateMemberRole,
  removeMember
};
