const db = require('../config/database');

// ─── GET /api/amenities ────────────────────────────────────────────────────
const getAmenities = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, price, status FROM amenities WHERE status = 'ACTIVE' ORDER BY name`
    );
    return res.json({ success: true, count: rows.length, amenities: rows });
  } catch (err) {
    console.error('Get amenities error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAmenities };
