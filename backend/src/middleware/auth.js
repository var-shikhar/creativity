const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const { rows } = await db.query(
        'SELECT id, email, full_name, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (rows.length === 0 || !rows[0].is_active) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      req.user = rows[0];
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const organizationMiddleware = async (req, res, next) => {
  try {
    const orgId = req.params.orgId || req.body.organization_id || req.query.organization_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    // Check if user belongs to organization
    const { rows } = await db.query(
      `SELECT uo.role, o.*
       FROM user_organizations uo
       JOIN organizations o ON o.id = uo.organization_id
       WHERE uo.user_id = $1 AND uo.organization_id = $2`,
      [req.user.id, orgId]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    req.organization = rows[0];
    req.userRole = rows[0].role;
    next();
  } catch (error) {
    console.error('Organization middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.userRole
      });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  organizationMiddleware,
  requireRole
};
