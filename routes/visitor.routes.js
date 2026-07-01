const express = require("express");
const router = express.Router();

const {
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
} = require("../controllers/visitor.controller");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { visitorUpload } = require("../config/visitorUpload");

// ── Reads — order matters: specific paths before /:id ───────────────────────
router.get("/pending", authMiddleware, getPendingVisitors);
router.get("/today", authMiddleware, getTodayVisitors);
router.get(
  "/history",
  authMiddleware,
  roleMiddleware("CHAIRMAN"),
  getVisitorHistory,
);
router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("SECURITY", "CHAIRMAN"),
  getVisitorDashboard,
);
router.get(
  "/analytics",
  authMiddleware,
  roleMiddleware("CHAIRMAN"),
  getVisitorAnalytics,
);
router.get("/", authMiddleware, getVisitors);
router.get("/:id", authMiddleware, getVisitorById);

// ── Security creates a new visitor (with photo) ──────────────────────────────
router.post(
  "/",
  authMiddleware,
  roleMiddleware("SECURITY", "CHAIRMAN"),
  visitorUpload.single("photo"),
  createVisitor,
);

// ── Resident / Chairman approval actions ─────────────────────────────────────
router.put(
  "/approve/:id",
  authMiddleware,
  roleMiddleware("RESIDENT", "CHAIRMAN"),
  approveVisitor,
);
router.put(
  "/reject/:id",
  authMiddleware,
  roleMiddleware("RESIDENT", "CHAIRMAN"),
  rejectVisitor,
);

// ── Security gate actions ─────────────────────────────────────────────────────
router.put(
  "/checkin/:id",
  authMiddleware,
  roleMiddleware("SECURITY", "CHAIRMAN"),
  checkInVisitor,
);
router.put(
  "/checkout/:id",
  authMiddleware,
  roleMiddleware("SECURITY", "CHAIRMAN"),
  checkOutVisitor,
);

module.exports = router;
