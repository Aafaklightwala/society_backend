const db = require('../config/database');

// ─── GET /api/visitors ─────────────────────────────────────────────────────
const getVisitors = async (req, res) => {
  const { role, society_id, flat_id } = req.user;
  const { date, status } = req.query; // optional filters

  try {
    let whereClause = '';
    let params      = [];

    if (role === 'SECURITY' || role === 'CHAIRMAN') {
      // See all flats in their society
      whereClause = `WHERE f.society_id = ?`;
      params.push(society_id);
    } else {
      // RESIDENT sees only their flat
      whereClause = `WHERE v.flat_id = ?`;
      params.push(flat_id);
    }

    if (date) {
      whereClause += ` AND DATE(v.entry_time) = ?`;
      params.push(date);
    }
    if (status) {
      whereClause += ` AND v.status = ?`;
      params.push(status);
    }

    const [rows] = await db.query(
      `SELECT 
         v.id, v.visitor_name, v.mobile, v.purpose, v.vehicle_number,
         v.status, v.entry_time, v.exit_time,
         f.wing, f.flat_number,
         u.name AS approved_by_name,
         sec.name AS security_name
       FROM visitors v
       JOIN flats f ON f.id = v.flat_id
       LEFT JOIN users u   ON u.id = v.approved_by
       LEFT JOIN users sec ON sec.id = v.security_id
       ${whereClause}
       ORDER BY v.entry_time DESC
       LIMIT 100`,
      params
    );

    return res.json({ success: true, count: rows.length, visitors: rows });

  } catch (err) {
    console.error('Get visitors error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── POST /api/visitors ────────────────────────────────────────────────────
// Security guard logs a visitor entry
const createVisitor = async (req, res) => {
  const { visitor_name, mobile, purpose, vehicle_number, flat_id } = req.body;

  if (!visitor_name || !flat_id) {
    return res.status(400).json({ success: false, message: 'visitor_name and flat_id are required.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO visitors (flat_id, visitor_name, mobile, purpose, vehicle_number, status, entry_time, security_id)
       VALUES (?, ?, ?, ?, ?, 'IN', NOW(), ?)`,
      [flat_id, visitor_name, mobile || null, purpose || null, vehicle_number || null, req.user.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Visitor entry logged.',
      visitor_id: result.insertId,
    });

  } catch (err) {
    console.error('Create visitor error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── PUT /api/visitors/:id ─────────────────────────────────────────────────
// Security marks visitor as OUT
const updateVisitor = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'OUT'

  if (!status) {
    return res.status(400).json({ success: false, message: 'status is required.' });
  }

  try {
    const [result] = await db.query(
      `UPDATE visitors SET status = ?, exit_time = NOW() WHERE id = ?`,
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Visitor not found.' });
    }

    return res.json({ success: true, message: 'Visitor status updated.' });

  } catch (err) {
    console.error('Update visitor error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getVisitors, createVisitor, updateVisitor };
