const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/intercom.controller");
const authMiddleware = require("../middleware/authMiddleware");

// User & presence
router.get("/users", authMiddleware, ctrl.getUsers);
router.get("/online", authMiddleware, ctrl.getOnlineUsers);

// Call history
router.get("/history", authMiddleware, ctrl.getCallHistory);
router.post("/call", authMiddleware, ctrl.createCallRecord);
router.post("/end", authMiddleware, ctrl.endCallRecord);

// Rooms (Chairman only — enforced inside controller)
router.get("/rooms", authMiddleware, ctrl.getRooms);
router.post("/room", authMiddleware, ctrl.createRoom);
router.delete("/room/:id", authMiddleware, ctrl.deleteRoom);
router.get("/room/:id", authMiddleware, ctrl.getRoomDetails);
router.delete("/room/:id/member/:userId", authMiddleware, ctrl.removeMember);

module.exports = router;
