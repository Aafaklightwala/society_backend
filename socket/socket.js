// socket/socket.js
// ─────────────────────────────────────────────────────────────────────────────
//  WebRTC Signaling Server using Socket.IO
//  Handles: presence, offer/answer/ICE, call control, room management
// ─────────────────────────────────────────────────────────────────────────────

const jwt = require("jsonwebtoken");
const db = require("../config/database");

// In-memory map: userId → socketId (fast lookups, no DB round-trip per event)
const onlineMap = new Map(); // userId(int) → socket.id

module.exports = (io) => {
  // ── JWT Auth middleware for Socket.IO ──────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Authentication error: no token"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, name, role, society_id, flat_id }
      next();
    } catch (err) {
      next(new Error("Authentication error: invalid token"));
    }
  });

  // ── Connection ─────────────────────────────────────────────────────────────
  io.on("connection", async (socket) => {
    const { id: userId, name, role, society_id } = socket.user;

    console.log(`[Socket] CONNECTED  user=${userId} (${name}) role=${role}`);

    // Register online presence
    onlineMap.set(userId, socket.id);
    await _upsertOnline(userId, socket.id);

    // Join a society room so we can broadcast to society members easily
    socket.join(`society:${society_id}`);

    // Notify society peers that this user came online
    socket.to(`society:${society_id}`).emit("user-online", {
      userId,
      name,
      role,
    });

    // ── CALL FLOW ─────────────────────────────────────────────────────────
    // Initiator sends offer to a specific target user
    socket.on("offer", ({ targetUserId, offer, callId, callerInfo }) => {
      const targetSocket = onlineMap.get(targetUserId);
      if (!targetSocket) {
        socket.emit("call-failed", { reason: "User is offline" });
        return;
      }
      io.to(targetSocket).emit("incoming-call", {
        callId,
        offer,
        callerInfo: {
          userId,
          name,
          role,
          ...callerInfo,
        },
      });
      console.log(`[Socket] OFFER  from=${userId} to=${targetUserId}`);
    });

    // Receiver sends answer back to caller
    socket.on("answer", ({ targetUserId, answer, callId }) => {
      const targetSocket = onlineMap.get(targetUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("call-accepted", { answer, callId });
      }
      console.log(`[Socket] ANSWER  from=${userId} to=${targetUserId}`);
    });

    // ICE candidates — relay between both peers
    socket.on("candidate", ({ targetUserId, candidate }) => {
      const targetSocket = onlineMap.get(targetUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("candidate", {
          candidate,
          fromUserId: userId,
        });
      }
    });

    // Callee rejected the call
    socket.on("reject-call", ({ targetUserId, callId }) => {
      const targetSocket = onlineMap.get(targetUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("call-rejected", { callId, byUserId: userId });
      }
      console.log(`[Socket] REJECTED  by=${userId} callId=${callId}`);
    });

    // Either party ends the call
    socket.on("end-call", ({ targetUserId, callId }) => {
      const targetSocket = onlineMap.get(targetUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("call-ended", { callId, byUserId: userId });
      }
      console.log(`[Socket] END-CALL  by=${userId} callId=${callId}`);
    });

    // ── GROUP ROOM FLOW ───────────────────────────────────────────────────
    socket.on("join-room", async ({ roomId }) => {
      const roomKey = `room:${roomId}`;
      socket.join(roomKey);

      // Persist member
      try {
        await db.query(
          `INSERT IGNORE INTO intercom_room_members (room_id, user_id) VALUES (?, ?)`,
          [roomId, userId],
        );
      } catch (_) {}

      // Tell everyone else in the room
      socket.to(roomKey).emit("peer-joined", { userId, name, role });
      console.log(`[Socket] JOIN-ROOM  user=${userId} room=${roomId}`);
    });

    socket.on("leave-room", ({ roomId }) => {
      const roomKey = `room:${roomId}`;
      socket.leave(roomKey);
      socket.to(roomKey).emit("peer-left", { userId });
      console.log(`[Socket] LEAVE-ROOM  user=${userId} room=${roomId}`);
    });

    // Relay offer/answer/ICE within a group room
    socket.on("room-offer", ({ roomId, targetUserId, offer }) => {
      const targetSocket = onlineMap.get(targetUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("room-offer", {
          fromUserId: userId,
          offer,
          roomId,
        });
      }
    });

    socket.on("room-answer", ({ roomId, targetUserId, answer }) => {
      const targetSocket = onlineMap.get(targetUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("room-answer", {
          fromUserId: userId,
          answer,
          roomId,
        });
      }
    });

    socket.on("room-candidate", ({ roomId, targetUserId, candidate }) => {
      const targetSocket = onlineMap.get(targetUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("room-candidate", {
          fromUserId: userId,
          candidate,
          roomId,
        });
      }
    });

    // ── MUTE / SPEAKER signals (UI state sync) ────────────────────────────
    socket.on("mute", ({ targetUserId, muted }) => {
      const targetSocket = onlineMap.get(targetUserId);
      if (targetSocket)
        io.to(targetSocket).emit("peer-muted", { userId, muted });
    });

    // ── DISCONNECT ─────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      onlineMap.delete(userId);
      await _setOffline(userId);
      socket.to(`society:${society_id}`).emit("user-offline", { userId });
      console.log(`[Socket] DISCONNECTED  user=${userId}`);
    });
  });
};

// ── DB helpers ─────────────────────────────────────────────────────────────
async function _upsertOnline(userId, socketId) {
  try {
    await db.query(
      `INSERT INTO online_users (user_id, socket_id, online, last_seen)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE socket_id = VALUES(socket_id), online = 1, last_seen = NOW()`,
      [userId, socketId],
    );
  } catch (err) {
    console.error("[Socket] _upsertOnline error:", err);
  }
}

async function _setOffline(userId) {
  try {
    await db.query(
      `UPDATE online_users SET online = 0, last_seen = NOW() WHERE user_id = ?`,
      [userId],
    );
  } catch (err) {
    console.error("[Socket] _setOffline error:", err);
  }
}
