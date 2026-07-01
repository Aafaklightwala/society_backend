// controllers/notification.controller.js
// ─────────────────────────────────────────────────────────────────────────────
//  Notifications — created internally by other controllers (e.g. visitor flow)
//  and read/marked-read by the Flutter app.
// ─────────────────────────────────────────────────────────────────────────────

const db = require("../config/database");

// Internal helper — call this from other controllers, not exposed as a route.
// io is the Socket.IO server instance (passed in from app.js / controller wiring).
async function createNotification({
  io,
  userId,
  title,
  message,
  type,
  visitorId = null,
}) {
  try {
    const [result] = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, visitor_id)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type, visitorId],
    );

    const notification = {
      id: result.insertId,
      user_id: userId,
      title,
      message,
      type,
      visitor_id: visitorId,
      is_read: 0,
      created_at: new Date(),
    };

    // Push live via Socket.IO if the server instance was provided
    if (io) {
      io.to(`user:${userId}`).emit("notification", notification);
    }

    return notification;
  } catch (err) {
    console.error("createNotification error:", err);
    return null;
  }
}

// ─── GET /api/notifications ─────────────────────────────────────────────────
const getNotifications = async (req, res) => {
  const userId = req.user.id;
  const { unread } = req.query;

  try {
    let query = `SELECT * FROM notifications WHERE user_id = ?`;
    const params = [userId];

    if (unread === "true") {
      query += ` AND is_read = 0`;
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const [rows] = await db.query(query, params);

    return res.json({ success: true, count: rows.length, notifications: rows });
  } catch (err) {
    console.error("getNotifications error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── PUT /api/notifications/:id/read ────────────────────────────────────────
const markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [result] = await db.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [id, userId],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found." });
    }

    return res.json({ success: true, message: "Marked as read." });
  } catch (err) {
    console.error("markAsRead error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── PUT /api/notifications/read-all ────────────────────────────────────────
const markAllAsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    await db.query(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [
      userId,
    ]);
    return res.json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (err) {
    console.error("markAllAsRead error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
};
