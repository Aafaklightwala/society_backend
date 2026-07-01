// controllers/visitor.controller.js
// ─────────────────────────────────────────────────────────────────────────────
//  Visitor Module v2 — PENDING/APPROVED/REJECTED approval flow
//                       WAITING/IN/OUT visit flow
//  Socket.IO events are emitted via req.app.get('io') (wired in app.js)
// ─────────────────────────────────────────────────────────────────────────────

const db = require("../config/database");
const { relativeVisitorPhotoPath } = require("../config/visitorUpload");
const { createNotification } = require("./notification.controller");

// Shared SELECT used by most read endpoints
const VISITOR_SELECT = `
  SELECT
    v.id, v.society_id, v.flat_id, v.visitor_name, v.mobile, v.purpose,
    v.vehicle_number, v.photo, v.approval_status, v.visit_status,
    v.security_id, v.approved_by, v.approved_at,
    v.entry_time, v.exit_time, v.resident_note, v.security_note,
    v.created_at, v.updated_at,
    f.wing, f.flat_number,
    sec.name  AS security_name,
    apr.name  AS approved_by_name
  FROM visitors v
  JOIN flats f       ON f.id = v.flat_id
  LEFT JOIN users sec ON sec.id = v.security_id
  LEFT JOIN users apr ON apr.id = v.approved_by
`;

// Look up which user(s) live in a flat (residents to notify)
async function getResidentUserIdsForFlat(flatId) {
  const [rows] = await db.query(
    `SELECT id FROM users WHERE flat_id = ? AND role = 'RESIDENT' AND status = 'ACTIVE'`,
    [flatId],
  );
  return rows.map((r) => r.id);
}

// Look up chairman(s) of a society
async function getChairmanUserIdsForSociety(societyId) {
  const [rows] = await db.query(
    `SELECT id FROM users WHERE society_id = ? AND role = 'CHAIRMAN' AND status = 'ACTIVE'`,
    [societyId],
  );
  return rows.map((r) => r.id);
}

function emitToUser(io, userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

function emitToSociety(io, societyId, event, payload) {
  if (io) io.to(`society:${societyId}`).emit(event, payload);
}

// ─── POST /api/visitors ─────────────────────────────────────────────────────
// Security creates a new visitor request. photo comes via multer (req.file).
const createVisitor = async (req, res) => {
  const { visitor_name, mobile, purpose, vehicle_number, flat_id } = req.body;
  const { id: securityId, society_id } = req.user;
  const io = req.app.get("io");

  if (!visitor_name || !flat_id) {
    return res.status(400).json({
      success: false,
      message: "visitor_name and flat_id are required.",
    });
  }

  const photoPath = req.file
    ? relativeVisitorPhotoPath(req.file.filename)
    : null;

  try {
    const [result] = await db.query(
      `INSERT INTO visitors
        (society_id, flat_id, visitor_name, mobile, purpose, vehicle_number, photo,
         approval_status, visit_status, security_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 'WAITING', ?)`,
      [
        society_id,
        flat_id,
        visitor_name,
        mobile || null,
        purpose || null,
        vehicle_number || null,
        photoPath,
        securityId,
      ],
    );

    const [[visitor]] = await db.query(`${VISITOR_SELECT} WHERE v.id = ?`, [
      result.insertId,
    ]);

    // Notify all residents of this flat + the chairman
    const residentIds = await getResidentUserIdsForFlat(flat_id);
    const chairmanIds = await getChairmanUserIdsForSociety(society_id);
    const recipients = [...new Set([...residentIds, ...chairmanIds])];

    for (const uid of recipients) {
      await createNotification({
        io,
        userId: uid,
        title: "New Visitor Waiting",
        message: `${visitor_name} is waiting for approval at ${visitor.wing}-${visitor.flat_number}.`,
        type: "VISITOR_NEW",
        visitorId: visitor.id,
      });
    }

    // Real-time push straight to resident dashboards (popup) + chairman feed
    residentIds.forEach((uid) => emitToUser(io, uid, "new-visitor", visitor));
    chairmanIds.forEach((uid) =>
      emitToUser(io, uid, "visitor-status-changed", visitor),
    );

    return res.status(201).json({
      success: true,
      message: "Visitor request sent for approval.",
      visitor,
    });
  } catch (err) {
    console.error("Create visitor error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/visitors ──────────────────────────────────────────────────────
const getVisitors = async (req, res) => {
  const { role, society_id, flat_id } = req.user;
  const { date, approval_status, visit_status } = req.query;

  try {
    let where = "";
    const params = [];

    if (role === "SECURITY" || role === "CHAIRMAN") {
      where = `WHERE f.society_id = ?`;
      params.push(society_id);
    } else {
      where = `WHERE v.flat_id = ?`;
      params.push(flat_id);
    }

    if (date) {
      where += ` AND DATE(v.created_at) = ?`;
      params.push(date);
    }
    if (approval_status) {
      where += ` AND v.approval_status = ?`;
      params.push(approval_status);
    }
    if (visit_status) {
      where += ` AND v.visit_status = ?`;
      params.push(visit_status);
    }

    const [rows] = await db.query(
      `${VISITOR_SELECT} ${where} ORDER BY v.created_at DESC LIMIT 200`,
      params,
    );

    return res.json({ success: true, count: rows.length, visitors: rows });
  } catch (err) {
    console.error("Get visitors error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/visitors/:id ──────────────────────────────────────────────────
const getVisitorById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(`${VISITOR_SELECT} WHERE v.id = ?`, [id]);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Visitor not found." });
    }
    return res.json({ success: true, visitor: rows[0] });
  } catch (err) {
    console.error("Get visitor by id error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/visitors/pending ──────────────────────────────────────────────
// Used by resident dashboard popup + chairman pending tab
const getPendingVisitors = async (req, res) => {
  const { role, society_id, flat_id } = req.user;

  try {
    let where = `WHERE v.approval_status = 'PENDING'`;
    const params = [];

    if (role === "RESIDENT") {
      where += ` AND v.flat_id = ?`;
      params.push(flat_id);
    } else {
      where += ` AND f.society_id = ?`;
      params.push(society_id);
    }

    const [rows] = await db.query(
      `${VISITOR_SELECT} ${where} ORDER BY v.created_at DESC`,
      params,
    );

    return res.json({ success: true, count: rows.length, visitors: rows });
  } catch (err) {
    console.error("Get pending visitors error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/visitors/today ─────────────────────────────────────────────────
const getTodayVisitors = async (req, res) => {
  const { role, society_id, flat_id } = req.user;

  try {
    let where = `WHERE DATE(v.created_at) = CURDATE()`;
    const params = [];

    if (role === "RESIDENT") {
      where += ` AND v.flat_id = ?`;
      params.push(flat_id);
    } else {
      where += ` AND f.society_id = ?`;
      params.push(society_id);
    }

    const [rows] = await db.query(
      `${VISITOR_SELECT} ${where} ORDER BY v.created_at DESC`,
      params,
    );

    return res.json({ success: true, count: rows.length, visitors: rows });
  } catch (err) {
    console.error("Get today visitors error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/visitors/history ───────────────────────────────────────────────
// Paginated history with optional date range, for Chairman search/filter
const getVisitorHistory = async (req, res) => {
  const { society_id } = req.user;
  const { from, to, page = 1, limit = 30, search } = req.query;

  try {
    let where = `WHERE f.society_id = ?`;
    const params = [society_id];

    if (from) {
      where += ` AND DATE(v.created_at) >= ?`;
      params.push(from);
    }
    if (to) {
      where += ` AND DATE(v.created_at) <= ?`;
      params.push(to);
    }
    if (search) {
      where += ` AND (v.visitor_name LIKE ? OR v.mobile LIKE ? OR v.vehicle_number LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await db.query(
      `${VISITOR_SELECT} ${where} ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset],
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM visitors v JOIN flats f ON f.id = v.flat_id ${where}`,
      params,
    );

    return res.json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      visitors: rows,
    });
  } catch (err) {
    console.error("Get visitor history error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── PUT /api/visitors/approve/:id ───────────────────────────────────────────
const approveVisitor = async (req, res) => {
  const { id } = req.params;
  const { id: approverId, role } = req.user;
  const { resident_note } = req.body;
  const io = req.app.get("io");

  if (role !== "RESIDENT" && role !== "CHAIRMAN") {
    return res
      .status(403)
      .json({ success: false, message: "Not authorized to approve visitors." });
  }

  try {
    const [[visitor]] = await db.query(`${VISITOR_SELECT} WHERE v.id = ?`, [
      id,
    ]);
    if (!visitor) {
      return res
        .status(404)
        .json({ success: false, message: "Visitor not found." });
    }
    if (visitor.approval_status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Visitor is already ${visitor.approval_status}.`,
      });
    }

    await db.query(
      `UPDATE visitors
       SET approval_status = 'APPROVED', approved_by = ?, approved_at = NOW(), resident_note = ?
       WHERE id = ?`,
      [approverId, resident_note || null, id],
    );

    const [[updated]] = await db.query(`${VISITOR_SELECT} WHERE v.id = ?`, [
      id,
    ]);

    // Notify the security guard who logged this visitor
    await createNotification({
      io,
      userId: updated.security_id,
      title: "Visitor Approved",
      message: `${updated.visitor_name} approved for ${updated.wing}-${updated.flat_number}. Please allow entry.`,
      type: "VISITOR_APPROVED",
      visitorId: updated.id,
    });

    emitToUser(io, updated.security_id, "visitor-approved", updated);
    emitToSociety(io, updated.society_id, "visitor-status-changed", updated);

    return res.json({
      success: true,
      message: "Visitor approved.",
      visitor: updated,
    });
  } catch (err) {
    console.error("Approve visitor error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── PUT /api/visitors/reject/:id ────────────────────────────────────────────
const rejectVisitor = async (req, res) => {
  const { id } = req.params;
  const { id: approverId, role } = req.user;
  const { resident_note } = req.body;
  const io = req.app.get("io");

  if (role !== "RESIDENT" && role !== "CHAIRMAN") {
    return res
      .status(403)
      .json({ success: false, message: "Not authorized to reject visitors." });
  }

  try {
    const [[visitor]] = await db.query(`${VISITOR_SELECT} WHERE v.id = ?`, [
      id,
    ]);
    if (!visitor) {
      return res
        .status(404)
        .json({ success: false, message: "Visitor not found." });
    }
    if (visitor.approval_status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Visitor is already ${visitor.approval_status}.`,
      });
    }

    await db.query(
      `UPDATE visitors
       SET approval_status = 'REJECTED', approved_by = ?, approved_at = NOW(), resident_note = ?
       WHERE id = ?`,
      [approverId, resident_note || null, id],
    );

    const [[updated]] = await db.query(`${VISITOR_SELECT} WHERE v.id = ?`, [
      id,
    ]);

    await createNotification({
      io,
      userId: updated.security_id,
      title: "Visitor Rejected",
      message: `${updated.visitor_name} was rejected for ${updated.wing}-${updated.flat_number}. Do not allow entry.`,
      type: "VISITOR_REJECTED",
      visitorId: updated.id,
    });

    emitToUser(io, updated.security_id, "visitor-rejected", updated);
    emitToSociety(io, updated.society_id, "visitor-status-changed", updated);

    return res.json({
      success: true,
      message: "Visitor rejected.",
      visitor: updated,
    });
  } catch (err) {
    console.error("Reject visitor error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── PUT /api/visitors/checkin/:id ───────────────────────────────────────────
// Security marks an APPROVED visitor as IN once they physically arrive
const checkInVisitor = async (req, res) => {
  const { id } = req.params;
  const { security_note } = req.body;
  const io = req.app.get("io");

  try {
    const [[visitor]] = await db.query(`${VISITOR_SELECT} WHERE v.id = ?`, [
      id,
    ]);
    if (!visitor) {
      return res
        .status(404)
        .json({ success: false, message: "Visitor not found." });
    }
    if (visitor.approval_status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Visitor must be APPROVED before check-in.",
      });
    }
    if (visitor.visit_status !== "WAITING") {
      return res.status(400).json({
        success: false,
        message: `Visitor is already ${visitor.visit_status}.`,
      });
    }

    await db.query(
      `UPDATE visitors SET visit_status = 'IN', entry_time = NOW(), security_note = ? WHERE id = ?`,
      [security_note || null, id],
    );

    const [[updated]] = await db.query(`${VISITOR_SELECT} WHERE v.id = ?`, [
      id,
    ]);

    emitToSociety(io, updated.society_id, "visitor-status-changed", updated);

    return res.json({
      success: true,
      message: "Visitor checked in.",
      visitor: updated,
    });
  } catch (err) {
    console.error("Check-in visitor error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── PUT /api/visitors/checkout/:id ──────────────────────────────────────────
const checkOutVisitor = async (req, res) => {
  const { id } = req.params;
  const io = req.app.get("io");

  try {
    const [[visitor]] = await db.query(`${VISITOR_SELECT} WHERE v.id = ?`, [
      id,
    ]);
    if (!visitor) {
      return res
        .status(404)
        .json({ success: false, message: "Visitor not found." });
    }
    if (visitor.visit_status !== "IN") {
      return res.status(400).json({
        success: false,
        message: "Visitor must be IN before check-out.",
      });
    }

    await db.query(
      `UPDATE visitors SET visit_status = 'OUT', exit_time = NOW() WHERE id = ?`,
      [id],
    );

    const [[updated]] = await db.query(`${VISITOR_SELECT} WHERE v.id = ?`, [
      id,
    ]);

    emitToSociety(io, updated.society_id, "visitor-status-changed", updated);

    return res.json({
      success: true,
      message: "Visitor checked out.",
      visitor: updated,
    });
  } catch (err) {
    console.error("Check-out visitor error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/visitors/dashboard ─────────────────────────────────────────────
// Quick counts for the security/chairman dashboard cards
const getVisitorDashboard = async (req, res) => {
  const { society_id } = req.user;

  try {
    const [[counts]] = await db.query(
      `SELECT
         SUM(approval_status = 'PENDING')                AS pending,
         SUM(approval_status = 'APPROVED')                AS approved,
         SUM(approval_status = 'REJECTED')                AS rejected,
         SUM(visit_status = 'IN')                         AS in_society,
         SUM(visit_status = 'OUT')                        AS exited,
         SUM(DATE(created_at) = CURDATE())                AS today_total
       FROM visitors v
       JOIN flats f ON f.id = v.flat_id
       WHERE f.society_id = ?`,
      [society_id],
    );

    return res.json({ success: true, dashboard: counts });
  } catch (err) {
    console.error("Get visitor dashboard error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/visitors/analytics ─────────────────────────────────────────────
// Chairman analytics — most visited flats, security performance, avg approval time
const getVisitorAnalytics = async (req, res) => {
  const { society_id } = req.user;
  const { from, to } = req.query;

  try {
    let dateWhere = "";
    const dateParams = [];
    if (from) {
      dateWhere += ` AND DATE(v.created_at) >= ?`;
      dateParams.push(from);
    }
    if (to) {
      dateWhere += ` AND DATE(v.created_at) <= ?`;
      dateParams.push(to);
    }

    // Monthly visitor count (last 6 months)
    const [monthly] = await db.query(
      `SELECT DATE_FORMAT(v.created_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM visitors v JOIN flats f ON f.id = v.flat_id
       WHERE f.society_id = ? AND v.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month`,
      [society_id],
    );

    // Most visited flats
    const [mostVisited] = await db.query(
      `SELECT f.wing, f.flat_number, COUNT(*) AS visit_count
       FROM visitors v JOIN flats f ON f.id = v.flat_id
       WHERE f.society_id = ? ${dateWhere}
       GROUP BY v.flat_id ORDER BY visit_count DESC LIMIT 10`,
      [society_id, ...dateParams],
    );

    // Security performance — visitors logged per guard
    const [securityPerf] = await db.query(
      `SELECT sec.id, sec.name, COUNT(*) AS visitors_logged
       FROM visitors v
       JOIN flats f ON f.id = v.flat_id
       JOIN users sec ON sec.id = v.security_id
       WHERE f.society_id = ? ${dateWhere}
       GROUP BY sec.id ORDER BY visitors_logged DESC`,
      [society_id, ...dateParams],
    );

    // Average resident response time (approval_status PENDING -> approved_at), in seconds
    const [[avgResponse]] = await db.query(
      `SELECT AVG(TIMESTAMPDIFF(SECOND, v.created_at, v.approved_at)) AS avg_seconds
       FROM visitors v JOIN flats f ON f.id = v.flat_id
       WHERE f.society_id = ? AND v.approved_at IS NOT NULL ${dateWhere}`,
      [society_id, ...dateParams],
    );

    return res.json({
      success: true,
      analytics: {
        monthly_visitors: monthly,
        most_visited_flats: mostVisited,
        security_performance: securityPerf,
        avg_resident_response_seconds: avgResponse.avg_seconds || 0,
      },
    });
  } catch (err) {
    console.error("Get visitor analytics error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  createVisitor,
  getVisitors,
  getVisitorById,
  getPendingVisitors,
  getTodayVisitors,
  getVisitorHistory,
  approveVisitor,
  rejectVisitor,
  checkInVisitor,
  checkOutVisitor,
  getVisitorDashboard,
  getVisitorAnalytics,
};
