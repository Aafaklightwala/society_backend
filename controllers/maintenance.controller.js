const db = require('../config/database');

// ─── GET /api/maintenance ──────────────────────────────────────────────────
const getMaintenance = async (req, res) => {
  const { role, society_id, flat_id } = req.user;
  const { status, month, year } = req.query;

  try {
    let whereClause = '';
    let params      = [];

    if (role === 'CHAIRMAN') {
      whereClause = `WHERE f.society_id = ?`;
      params.push(society_id);
    } else {
      whereClause = `WHERE m.flat_id = ?`;
      params.push(flat_id);
    }

    if (status) { whereClause += ` AND m.status = ?`;  params.push(status); }
    if (month)  { whereClause += ` AND m.month = ?`;   params.push(month); }
    if (year)   { whereClause += ` AND m.year = ?`;    params.push(year); }

    const [rows] = await db.query(
      `SELECT 
         m.id, m.flat_id, m.month, m.year, m.amount, m.paid, m.status,
         f.wing, f.flat_number, f.owner_name
       FROM maintenance m
       JOIN flats f ON f.id = m.flat_id
       ${whereClause}
       ORDER BY m.year DESC, m.month DESC`,
      params
    );

    return res.json({ success: true, count: rows.length, maintenance: rows });

  } catch (err) {
    console.error('Get maintenance error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── POST /api/maintenance ─────────────────────────────────────────────────
// Chairman generates maintenance bills
const createMaintenance = async (req, res) => {
  const { flat_id, month, year, amount } = req.body;

  if (!flat_id || !month || !year || !amount) {
    return res.status(400).json({ success: false, message: 'flat_id, month, year, amount are required.' });
  }

  try {
    // Avoid duplicates
    const [existing] = await db.query(
      `SELECT id FROM maintenance WHERE flat_id = ? AND month = ? AND year = ?`,
      [flat_id, month, year]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Maintenance bill already exists for this flat and month.' });
    }

    const [result] = await db.query(
      `INSERT INTO maintenance (flat_id, month, year, amount, paid, status) VALUES (?, ?, ?, ?, 0, 'PENDING')`,
      [flat_id, month, year, amount]
    );

    return res.status(201).json({ success: true, message: 'Maintenance bill created.', id: result.insertId });

  } catch (err) {
    console.error('Create maintenance error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── PUT /api/maintenance/:id ──────────────────────────────────────────────
// Chairman marks payment received
const updateMaintenance = async (req, res) => {
  const { id } = req.params;
  const { paid, status } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE maintenance SET paid = ?, status = ? WHERE id = ?`,
      [paid, status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }

    return res.json({ success: true, message: 'Maintenance updated.' });

  } catch (err) {
    console.error('Update maintenance error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getMaintenance, createMaintenance, updateMaintenance };
