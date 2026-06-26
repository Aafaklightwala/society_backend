const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../config/database');
require('dotenv').config();

// ─── POST /api/auth/login ──────────────────────────────────────────────────
const login = async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    // Fetch user with society and flat info
    const [rows] = await db.query(
      `SELECT 
         u.id, u.name, u.username, u.password, u.role, u.status,
         u.society_id, u.flat_id,
         s.name  AS society_name,
         f.wing, f.flat_number
       FROM users u
       LEFT JOIN societies s ON s.id = u.society_id
       LEFT JOIN flats f     ON f.id = u.flat_id
       WHERE u.username = ? LIMIT 1`,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const user = rows[0];

    // Check account active
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Your account is inactive. Contact admin.' });
    }

    // Compare password with bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Sign JWT
    const payload = {
      id:         user.id,
      name:       user.name,
      role:       user.role,
      society_id: user.society_id,
      flat_id:    user.flat_id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    // Return everything Flutter needs
    return res.json({
      success: true,
      token,
      user: {
        id:           user.id,
        name:         user.name,
        username:     user.username,
        role:         user.role,
        society_id:   user.society_id,
        society_name: user.society_name,
        flat_id:      user.flat_id,
        wing:         user.wing,
        flat_number:  user.flat_number,
      },
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ─── GET /api/auth/me  (verify token + refresh user info) ─────────────────
const getMe = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         u.id, u.name, u.username, u.role, u.status,
         u.society_id, u.flat_id,
         s.name AS society_name,
         f.wing, f.flat_number
       FROM users u
       LEFT JOIN societies s ON s.id = u.society_id
       LEFT JOIN flats f     ON f.id = u.flat_id
       WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('GetMe error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { login, getMe };
