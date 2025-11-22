const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../config/database');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, full_name, organization_name } = req.body;

    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Start transaction
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, full_name, created_at`,
        [email, password_hash, full_name]
      );

      const user = userResult.rows[0];

      // Create organization
      const orgSlug = (organization_name || `${email.split('@')[0]}-org`)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-');

      const orgResult = await client.query(
        `INSERT INTO organizations (name, slug, plan_type)
         VALUES ($1, $2, $3)
         RETURNING id, name, slug, plan_type`,
        [organization_name || `${user.full_name}'s Organization`, orgSlug, 'free']
      );

      const organization = orgResult.rows[0];

      // Link user to organization as owner
      await client.query(
        `INSERT INTO user_organizations (user_id, organization_id, role)
         VALUES ($1, $2, $3)`,
        [user.id, organization.id, 'owner']
      );

      await client.query('COMMIT');

      const token = generateToken(user.id);

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name
        },
        organization,
        token
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Get user
    const result = await db.query(
      'SELECT id, email, password_hash, full_name, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Get user's organizations
    const orgsResult = await db.query(
      `SELECT o.id, o.name, o.slug, o.plan_type, uo.role
       FROM organizations o
       JOIN user_organizations uo ON uo.organization_id = o.id
       WHERE uo.user_id = $1
       ORDER BY uo.joined_at DESC`,
      [user.id]
    );

    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      },
      organizations: orgsResult.rows,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

const getProfile = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, email, full_name, created_at, last_login
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get organizations
    const orgsResult = await db.query(
      `SELECT o.id, o.name, o.slug, o.plan_type, uo.role
       FROM organizations o
       JOIN user_organizations uo ON uo.organization_id = o.id
       WHERE uo.user_id = $1
       ORDER BY uo.joined_at DESC`,
      [req.user.id]
    );

    res.json({
      user: rows[0],
      organizations: orgsResult.rows
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

module.exports = {
  register,
  login,
  getProfile
};
