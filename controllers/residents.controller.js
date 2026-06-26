const db = require("../config/database");

// ─── GET /api/residents ────────────────────────────────────────────────────
// Returns all residents with their flat info, grouped usable by Flutter
// Query params: ?wing=A  (optional filter)
const getResidents = async (req, res) => {
  const { society_id } = req.user;
  const { wing } = req.query;

  try {
    let whereClause = `WHERE u.role = 'RESIDENT' AND u.status = 'ACTIVE' AND f.society_id = ?`;
    const params = [society_id];

    if (wing) {
      whereClause += ` AND f.wing = ?`;
      params.push(wing);
    }

    const [rows] = await db.query(
      `SELECT 
         u.id,
         u.name,
         u.mobile,
         u.email,
         u.status,
         f.id          AS flat_id,
         f.wing,
         f.flat_number,
         f.floor,
         f.owner_name
       FROM users u
       JOIN flats f ON f.id = u.flat_id
       ${whereClause}
       ORDER BY f.wing ASC, f.flat_number ASC`,
      params,
    );

    // Get distinct wings for the filter chips
    const [wings] = await db.query(
      `SELECT DISTINCT f.wing 
       FROM flats f 
       WHERE f.society_id = ? AND f.status = 'ACTIVE'
       ORDER BY f.wing ASC`,
      [society_id],
    );

    return res.json({
      success: true,
      count: rows.length,
      wings: wings.map((w) => w.wing),
      residents: rows,
    });
  } catch (err) {
    console.error("Get residents error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/residents/flats ──────────────────────────────────────────────
// Returns flat list with resident count — used by intercom to show ALL flats
// including unoccupied ones (for future door panels etc.)
const getFlats = async (req, res) => {
  const { society_id } = req.user;
  const { wing } = req.query;

  try {
    let whereClause = `WHERE f.society_id = ? AND f.status = 'ACTIVE'`;
    const params = [society_id];

    if (wing) {
      whereClause += ` AND f.wing = ?`;
      params.push(wing);
    }

    const [rows] = await db.query(
      `SELECT 
         f.id, f.wing, f.flat_number, f.floor, f.owner_name, f.status,
         COUNT(u.id) AS resident_count,
         GROUP_CONCAT(u.name ORDER BY u.name SEPARATOR ', ') AS resident_names,
         GROUP_CONCAT(u.mobile ORDER BY u.name SEPARATOR ', ') AS resident_mobiles
       FROM flats f
       LEFT JOIN users u ON u.flat_id = f.id AND u.role = 'RESIDENT' AND u.status = 'ACTIVE'
       ${whereClause}
       GROUP BY f.id
       ORDER BY f.wing ASC, f.flat_number ASC`,
      params,
    );

    const [wings] = await db.query(
      `SELECT DISTINCT wing FROM flats WHERE society_id = ? AND status = 'ACTIVE' ORDER BY wing`,
      [society_id],
    );

    return res.json({
      success: true,
      count: rows.length,
      wings: wings.map((w) => w.wing),
      flats: rows,
    });
  } catch (err) {
    console.error("Get flats error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { getResidents, getFlats };
