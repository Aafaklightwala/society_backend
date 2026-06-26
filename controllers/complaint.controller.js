const db = require('../config/database');

// ─── GET /api/complaints ───────────────────────────────────────────────────
const getComplaints = async (req, res) => {
  const { role, society_id, flat_id } = req.user;
  const { status } = req.query;

  try {
    let whereClause = '';
    let params      = [];

    if (role === 'CHAIRMAN') {
      whereClause = `WHERE f.society_id = ?`;
      params.push(society_id);
    } else {
      whereClause = `WHERE c.flat_id = ?`;
      params.push(flat_id);
    }

    if (status) { whereClause += ` AND c.status = ?`; params.push(status); }

    const [rows] = await db.query(
      `SELECT 
         c.id, c.title, c.description, c.status, c.created_at,
         f.wing, f.flat_number, f.owner_name,
         u.name AS created_by_name,
         a.name AS assigned_to_name
       FROM complaints c
       JOIN flats f        ON f.id = c.flat_id
       LEFT JOIN users u   ON u.id = c.created_by
       LEFT JOIN users a   ON a.id = c.assigned_to
       ${whereClause}
       ORDER BY c.created_at DESC`,
      params
    );

    return res.json({ success: true, count: rows.length, complaints: rows });

  } catch (err) {
    console.error('Get complaints error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── POST /api/complaints ──────────────────────────────────────────────────
const createComplaint = async (req, res) => {
  const { title, description } = req.body;
  const { id: user_id, flat_id } = req.user;

  if (!title || !flat_id) {
    return res.status(400).json({ success: false, message: 'title is required.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO complaints (flat_id, title, description, status, created_by, created_at)
       VALUES (?, ?, ?, 'PENDING', ?, NOW())`,
      [flat_id, title, description || null, user_id]
    );

    return res.status(201).json({ success: true, message: 'Complaint submitted.', id: result.insertId });

  } catch (err) {
    console.error('Create complaint error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── PUT /api/complaints/:id ───────────────────────────────────────────────
// Chairman updates status / assigns
const updateComplaint = async (req, res) => {
  const { id } = req.params;
  const { status, assigned_to } = req.body;

  try {
    const [result] = await db.query(
      `UPDATE complaints SET status = ?, assigned_to = ? WHERE id = ?`,
      [status, assigned_to || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    return res.json({ success: true, message: 'Complaint updated.' });

  } catch (err) {
    console.error('Update complaint error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getComplaints, createComplaint, updateComplaint };
