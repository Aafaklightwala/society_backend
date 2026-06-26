const express = require("express");
const router = express.Router();
const {
  getResidents,
  getFlats,
} = require("../controllers/residents.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Chairman sees all residents
router.get("/", authMiddleware, roleMiddleware("CHAIRMAN"), getResidents);

// Flats list — Chairman + Security (for intercom)
router.get(
  "/flats",
  authMiddleware,
  roleMiddleware("CHAIRMAN", "SECURITY"),
  getFlats,
);

module.exports = router;
