// middleware/amenity.validation.js
// ─────────────────────────────────────────────────────────────────────────────
//  Request validation for amenity create / update
// ─────────────────────────────────────────────────────────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

function validateAmenity(req, res, next) {
  const { name, status, capacity, opening_time, closing_time } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Amenity name is required." });
  }
  if (name.trim().length > 120) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Name must be 120 characters or fewer.",
      });
  }

  if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
    return res
      .status(400)
      .json({
        success: false,
        message: "status must be 'ACTIVE' or 'INACTIVE'.",
      });
  }

  if (capacity !== undefined && capacity !== null && capacity !== "") {
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Capacity must be a positive integer.",
        });
    }
  }

  if (opening_time && !TIME_RE.test(opening_time)) {
    return res
      .status(400)
      .json({
        success: false,
        message: "opening_time must be in HH:MM format.",
      });
  }
  if (closing_time && !TIME_RE.test(closing_time)) {
    return res
      .status(400)
      .json({
        success: false,
        message: "closing_time must be in HH:MM format.",
      });
  }

  next();
}

module.exports = { validateAmenity };
