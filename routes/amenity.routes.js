// routes/amenity.routes.js
// ─────────────────────────────────────────────────────────────────────────────
//  Amenities Module — no booking, no reservation
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/amenity.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateAmenity } = require("../middleware/amenity.validation");
const { amenityUpload } = require("../config/amenityUpload");

// ── Read — Chairman + Resident ───────────────────────────────────────────────
// IMPORTANT: specific paths must come BEFORE /:id
router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("CHAIRMAN"),
  ctrl.getDashboard,
);
router.get("/", authMiddleware, ctrl.getAmenities);
router.get("/:id", authMiddleware, ctrl.getAmenityById);

// ── Write — Chairman only ────────────────────────────────────────────────────
router.post(
  "/",
  authMiddleware,
  roleMiddleware("CHAIRMAN"),
  amenityUpload.single("image"),
  validateAmenity,
  ctrl.createAmenity,
);

router.put(
  "/status/:id",
  authMiddleware,
  roleMiddleware("CHAIRMAN"),
  ctrl.toggleStatus,
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("CHAIRMAN"),
  amenityUpload.single("image"),
  validateAmenity,
  ctrl.updateAmenity,
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CHAIRMAN"),
  ctrl.deleteAmenity,
);

module.exports = router;
