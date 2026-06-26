const db = require('../config/database');

// ─── GET /api/dashboard ────────────────────────────────────────────────────
// Returns different stats based on role
const getDashboard = async (req, res) => {
  const { role, society_id, flat_id } = req.user;

  try {
    let data = {};

    if (role === 'CHAIRMAN') {
      // Full society stats
      const [[totalResidents]] = await db.query(
        `SELECT COUNT(*) AS count FROM users WHERE society_id = ? AND role = 'RESIDENT' AND status = 'ACTIVE'`,
        [society_id]
      );
      const [[totalFlats]] = await db.query(
        `SELECT COUNT(*) AS count FROM flats WHERE society_id = ? AND status = 'ACTIVE'`,
        [society_id]
      );
      const [[todayVisitors]] = await db.query(
        `SELECT COUNT(*) AS count FROM visitors 
         WHERE DATE(entry_time) = CURDATE() 
         AND flat_id IN (SELECT id FROM flats WHERE society_id = ?)`,
        [society_id]
      );
      const [[pendingComplaints]] = await db.query(
        `SELECT COUNT(*) AS count FROM complaints 
         WHERE status = 'PENDING' 
         AND flat_id IN (SELECT id FROM flats WHERE society_id = ?)`,
        [society_id]
      );
      const [[pendingMaintenance]] = await db.query(
        `SELECT COUNT(*) AS count FROM maintenance 
         WHERE status = 'PENDING' 
         AND flat_id IN (SELECT id FROM flats WHERE society_id = ?)`,
        [society_id]
      );

      data = {
        total_residents:    totalResidents.count,
        total_flats:        totalFlats.count,
        today_visitors:     todayVisitors.count,
        pending_complaints: pendingComplaints.count,
        pending_maintenance: pendingMaintenance.count,
      };

    } else if (role === 'RESIDENT') {
      // Only their flat's data
      const [[myVisitors]] = await db.query(
        `SELECT COUNT(*) AS count FROM visitors WHERE flat_id = ? AND DATE(entry_time) = CURDATE()`,
        [flat_id]
      );
      const [[myComplaints]] = await db.query(
        `SELECT COUNT(*) AS count FROM complaints WHERE flat_id = ? AND status = 'PENDING'`,
        [flat_id]
      );
      const [[myMaintenance]] = await db.query(
        `SELECT COUNT(*) AS count FROM maintenance WHERE flat_id = ? AND status = 'PENDING'`,
        [flat_id]
      );

      data = {
        my_today_visitors:     myVisitors.count,
        my_pending_complaints: myComplaints.count,
        my_pending_maintenance: myMaintenance.count,
      };

    } else if (role === 'SECURITY') {
      // Today's gate activity
      const [[todayIn]] = await db.query(
        `SELECT COUNT(*) AS count FROM visitors 
         WHERE DATE(entry_time) = CURDATE() 
         AND flat_id IN (SELECT id FROM flats WHERE society_id = ?)
         AND status = 'IN'`,
        [society_id]
      );
      const [[todayOut]] = await db.query(
        `SELECT COUNT(*) AS count FROM visitors 
         WHERE DATE(entry_time) = CURDATE() 
         AND flat_id IN (SELECT id FROM flats WHERE society_id = ?)
         AND status = 'OUT'`,
        [society_id]
      );

      data = {
        visitors_inside: todayIn.count,
        visitors_exited: todayOut.count,
      };
    }

    return res.json({ success: true, role, data });

  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getDashboard };
