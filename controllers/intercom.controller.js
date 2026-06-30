// controllers/intercom.controller.js
// ─────────────────────────────────────────────────────────────────────────────
//  Intercom REST controller
//  Handles: rooms, call history, online users
// ─────────────────────────────────────────────────────────────────────────────

const db = require("../config/database");

// ── GET /api/intercom/users ───────────────────────────────────────────────────
// Returns all callable users in the same society (residents, chairman, security)
// with their online status
const getUsers = async (req, res) => {
  const { society_id, id: self_id } = req.user;
  try {
    const [rows] = await db.query(
      `SELECT
         u.id, u.name, u.role, u.status,
         f.wing, f.flat_number,
         ou.online,
         ou.last_seen,
         ou.socket_id
       FROM users u
       LEFT JOIN flats f        ON f.id = u.flat_id
       LEFT JOIN online_users ou ON ou.user_id = u.id
       WHERE u.society_id = ?
         AND u.status = 'ACTIVE'
         AND u.id != ?
       ORDER BY ou.online DESC, u.role ASC, u.name ASC`,
      [society_id, self_id],
    );
    return res.json({ success: true, users: rows });
  } catch (err) {
    console.error("[Intercom] getUsers error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── GET /api/intercom/online ──────────────────────────────────────────────────
// Returns currently online user IDs for this society
const getOnlineUsers = async (req, res) => {
  const { society_id } = req.user;
  try {
    const [rows] = await db.query(
      `SELECT ou.user_id, ou.last_seen
       FROM online_users ou
       JOIN users u ON u.id = ou.user_id
       WHERE u.society_id = ? AND ou.online = 1`,
      [society_id],
    );
    return res.json({ success: true, online: rows });
  } catch (err) {
    console.error("[Intercom] getOnlineUsers error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── GET /api/intercom/rooms ───────────────────────────────────────────────────
// Returns active rooms for this society
const getRooms = async (req, res) => {
  const { society_id } = req.user;
  try {
    const [rooms] = await db.query(
      `SELECT
         r.id, r.room_name, r.room_type, r.is_active, r.created_at,
         u.name AS created_by_name,
         COUNT(m.id) AS member_count
       FROM intercom_rooms r
       JOIN users u ON u.id = r.created_by
       LEFT JOIN intercom_room_members m ON m.room_id = r.id
       WHERE r.society_id = ? AND r.is_active = 1
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [society_id],
    );
    return res.json({ success: true, rooms });
  } catch (err) {
    console.error("[Intercom] getRooms error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── POST /api/intercom/room ───────────────────────────────────────────────────
// Chairman only — create a new room
const createRoom = async (req, res) => {
  if (req.user.role !== "CHAIRMAN") {
    return res
      .status(403)
      .json({ success: false, message: "Only Chairman can create rooms." });
  }
  const { room_name, room_type } = req.body;
  const validTypes = ["WING", "SOCIETY", "EMERGENCY"];

  if (!room_name || !validTypes.includes(room_type)) {
    return res.status(400).json({
      success: false,
      message: `room_name and room_type (${validTypes.join("|")}) are required.`,
    });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO intercom_rooms (society_id, room_name, room_type, created_by)
       VALUES (?, ?, ?, ?)`,
      [req.user.society_id, room_name, room_type, req.user.id],
    );
    return res.status(201).json({
      success: true,
      message: "Room created.",
      room_id: result.insertId,
    });
  } catch (err) {
    console.error("[Intercom] createRoom error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── DELETE /api/intercom/room/:id ─────────────────────────────────────────────
// Chairman only — deactivate a room
const deleteRoom = async (req, res) => {
  if (req.user.role !== "CHAIRMAN") {
    return res.status(403).json({ success: false, message: "Forbidden." });
  }
  try {
    await db.query(
      `UPDATE intercom_rooms SET is_active = 0 WHERE id = ? AND society_id = ?`,
      [req.params.id, req.user.society_id],
    );
    return res.json({ success: true, message: "Room closed." });
  } catch (err) {
    console.error("[Intercom] deleteRoom error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── POST /api/intercom/call ───────────────────────────────────────────────────
// Creates a call history record — called when initiating a call
const createCallRecord = async (req, res) => {
  const { receiver_id, room_id, call_type } = req.body;
  const caller_id = req.user.id;

  try {
    const [result] = await db.query(
      `INSERT INTO call_history (caller_id, receiver_id, room_id, call_type, status, started_at)
       VALUES (?, ?, ?, ?, 'MISSED', NOW())`,
      [
        caller_id,
        receiver_id || null,
        room_id || null,
        call_type || "INDIVIDUAL",
      ],
    );
    return res.status(201).json({ success: true, call_id: result.insertId });
  } catch (err) {
    console.error("[Intercom] createCallRecord error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── POST /api/intercom/end ────────────────────────────────────────────────────
// Updates a call record when call ends
const endCallRecord = async (req, res) => {
  const { call_id, status, duration } = req.body;
  // status: ANSWERED | REJECTED | MISSED | ENDED

  if (!call_id || !status) {
    return res
      .status(400)
      .json({ success: false, message: "call_id and status required." });
  }

  try {
    await db.query(
      `UPDATE call_history
       SET status = ?, ended_at = NOW(), duration = ?
       WHERE id = ?`,
      [status, duration || 0, call_id],
    );
    return res.json({ success: true, message: "Call record updated." });
  } catch (err) {
    console.error("[Intercom] endCallRecord error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── GET /api/intercom/history ─────────────────────────────────────────────────
// Returns call history for the logged-in user
const getCallHistory = async (req, res) => {
  const { id: user_id } = req.user;
  const limit = parseInt(req.query.limit) || 50;

  try {
    const [rows] = await db.query(
      `SELECT
         h.id, h.call_type, h.status, h.started_at, h.ended_at, h.duration,
         caller.id   AS caller_id,   caller.name   AS caller_name,   caller.role AS caller_role,
         receiver.id AS receiver_id, receiver.name AS receiver_name,
         cf.wing AS caller_wing, cf.flat_number AS caller_flat,
         rf.wing AS receiver_wing, rf.flat_number AS receiver_flat,
         r.room_name
       FROM call_history h
       JOIN users caller          ON caller.id = h.caller_id
       LEFT JOIN users receiver   ON receiver.id = h.receiver_id
       LEFT JOIN flats cf         ON cf.id = caller.flat_id
       LEFT JOIN flats rf         ON rf.id = receiver.flat_id
       LEFT JOIN intercom_rooms r ON r.id = h.room_id
       WHERE h.caller_id = ? OR h.receiver_id = ?
       ORDER BY h.started_at DESC
       LIMIT ?`,
      [user_id, user_id, limit],
    );
    return res.json({ success: true, count: rows.length, history: rows });
  } catch (err) {
    console.error("[Intercom] getCallHistory error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// Returns room details + member list (with online status)
const getRoomDetails = async (req, res) => {
  const { society_id } = req.user;
  const roomId = req.params.id;

  try {
    const [[room]] = await db.query(
      `SELECT
         r.id, r.room_name, r.room_type, r.is_active, r.created_at,
         r.created_by, u.name AS created_by_name
       FROM intercom_rooms r
       JOIN users u ON u.id = r.created_by
       WHERE r.id = ? AND r.society_id = ?`,
      [roomId, society_id],
    );

    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found." });
    }

    const [members] = await db.query(
      `SELECT
         u.id, u.name, u.role,
         f.wing, f.flat_number,
         ou.online, ou.last_seen
       FROM intercom_room_members m
       JOIN users u        ON u.id = m.user_id
       LEFT JOIN flats f        ON f.id = u.flat_id
       LEFT JOIN online_users ou ON ou.user_id = u.id
       WHERE m.room_id = ?
       ORDER BY ou.online DESC, u.role ASC, u.name ASC`,
      [roomId],
    );

    return res.json({ success: true, room, members });
  } catch (err) {
    console.error("[Intercom] getRoomDetails error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── DELETE /api/intercom/room/:id/member/:userId ───────────────────────────────
// Chairman only — remove a member from a room
const removeMember = async (req, res) => {
  if (req.user.role !== "CHAIRMAN") {
    return res.status(403).json({ success: false, message: "Forbidden." });
  }
  try {
    await db.query(
      `DELETE FROM intercom_room_members WHERE room_id = ? AND user_id = ?`,
      [req.params.id, req.params.userId],
    );
    return res.json({ success: true, message: "Member removed." });
  } catch (err) {
    console.error("[Intercom] removeMember error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  getUsers,
  getOnlineUsers,
  getRooms,
  createRoom,
  deleteRoom,
  createCallRecord,
  endCallRecord,
  getCallHistory,
  getRoomDetails,
  removeMember,
};
