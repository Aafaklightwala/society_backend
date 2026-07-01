// controllers/amenity.controller.js
// ─────────────────────────────────────────────────────────────────────────────
//  Amenities Module — no booking, no reservation
//  Chairman : full CRUD + image + status toggle
//  Resident  : read-only (all amenities incl. inactive)
// ─────────────────────────────────────────────────────────────────────────────

const db = require("../config/database");
const path = require("path");
const fs = require("fs");
const { relativeAmenityPhotoPath } = require("../config/amenityUpload");

// Shared SELECT columns
const SELECT = `
  SELECT
    a.id, a.society_id, a.name, a.description, a.image,
    a.location, a.opening_time, a.closing_time,
    a.capacity, a.rules, a.status,
    a.created_at, a.updated_at,
    u.name AS created_by_name
  FROM amenities a
  LEFT JOIN users u ON u.id = a.created_by
`;

// ── GET /api/amenities ────────────────────────────────────────────────────────
// Both Chairman and Resident — returns ALL amenities for the society
// Optional query params: search, status
const getAmenities = async (req, res) => {
  const { society_id } = req.user;
  const { search, status } = req.query;

  try {
    let where = "WHERE a.society_id = ?";
    const params = [society_id];

    if (status && ["ACTIVE", "INACTIVE"].includes(status)) {
      where += " AND a.status = ?";
      params.push(status);
    }

    if (search && search.trim()) {
      where += " AND (a.name LIKE ? OR a.location LIKE ?)";
      const like = `%${search.trim()}%`;
      params.push(like, like);
    }

    const [rows] = await db.query(
      `${SELECT} ${where} ORDER BY a.status ASC, a.name ASC`,
      params,
    );

    return res.json({ success: true, count: rows.length, amenities: rows });
  } catch (err) {
    console.error("[Amenity] getAmenities error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── GET /api/amenities/dashboard ──────────────────────────────────────────────
// Chairman only — summary counts + recently added
const getDashboard = async (req, res) => {
  const { society_id } = req.user;

  try {
    const [[counts]] = await db.query(
      `SELECT
         COUNT(*)                              AS total,
         SUM(status = 'ACTIVE')               AS active,
         SUM(status = 'INACTIVE')             AS inactive
       FROM amenities
       WHERE society_id = ?`,
      [society_id],
    );

    const [recent] = await db.query(
      `${SELECT}
       WHERE a.society_id = ?
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [society_id],
    );

    return res.json({
      success: true,
      dashboard: {
        total: counts.total ?? 0,
        active: counts.active ?? 0,
        inactive: counts.inactive ?? 0,
        recent,
      },
    });
  } catch (err) {
    console.error("[Amenity] getDashboard error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── GET /api/amenities/:id ────────────────────────────────────────────────────
const getAmenityById = async (req, res) => {
  const { society_id } = req.user;
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `${SELECT} WHERE a.id = ? AND a.society_id = ?`,
      [id, society_id],
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Amenity not found." });
    }
    return res.json({ success: true, amenity: rows[0] });
  } catch (err) {
    console.error("[Amenity] getAmenityById error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── POST /api/amenities ───────────────────────────────────────────────────────
// Chairman only
const createAmenity = async (req, res) => {
  const { society_id, id: userId } = req.user;
  const {
    name,
    description,
    location,
    opening_time,
    closing_time,
    capacity,
    rules,
    status,
  } = req.body;

  const imagePath = req.file
    ? relativeAmenityPhotoPath(req.file.filename)
    : null;

  try {
    const [result] = await db.query(
      `INSERT INTO amenities
         (society_id, name, description, image, location,
          opening_time, closing_time, capacity, rules, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        society_id,
        name.trim(),
        description || null,
        imagePath,
        location || null,
        opening_time || null,
        closing_time || null,
        capacity ? Number(capacity) : null,
        rules || null,
        status || "ACTIVE",
        userId,
      ],
    );

    const [[amenity]] = await db.query(`${SELECT} WHERE a.id = ?`, [
      result.insertId,
    ]);

    return res.status(201).json({
      success: true,
      message: "Amenity created.",
      amenity,
    });
  } catch (err) {
    console.error("[Amenity] createAmenity error:", err);
    // Remove uploaded file if DB insert failed
    if (req.file) _deleteFile(req.file.path);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── PUT /api/amenities/:id ────────────────────────────────────────────────────
// Chairman only
const updateAmenity = async (req, res) => {
  const { society_id } = req.user;
  const { id } = req.params;
  const {
    name,
    description,
    location,
    opening_time,
    closing_time,
    capacity,
    rules,
    status,
  } = req.body;

  try {
    // Fetch existing to check ownership and get old image
    const [[existing]] = await db.query(
      `SELECT id, image FROM amenities WHERE id = ? AND society_id = ?`,
      [id, society_id],
    );
    if (!existing) {
      if (req.file) _deleteFile(req.file.path);
      return res
        .status(404)
        .json({ success: false, message: "Amenity not found." });
    }

    // If a new image was uploaded, delete the old one
    let imagePath = existing.image;
    if (req.file) {
      if (existing.image) _deleteFile(_absolutePath(existing.image));
      imagePath = relativeAmenityPhotoPath(req.file.filename);
    }

    await db.query(
      `UPDATE amenities SET
         name         = ?,
         description  = ?,
         image        = ?,
         location     = ?,
         opening_time = ?,
         closing_time = ?,
         capacity     = ?,
         rules        = ?,
         status       = ?
       WHERE id = ? AND society_id = ?`,
      [
        name.trim(),
        description || null,
        imagePath,
        location || null,
        opening_time || null,
        closing_time || null,
        capacity ? Number(capacity) : null,
        rules || null,
        status || "ACTIVE",
        id,
        society_id,
      ],
    );

    const [[amenity]] = await db.query(`${SELECT} WHERE a.id = ?`, [id]);

    return res.json({ success: true, message: "Amenity updated.", amenity });
  } catch (err) {
    console.error("[Amenity] updateAmenity error:", err);
    if (req.file) _deleteFile(req.file.path);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── DELETE /api/amenities/:id ─────────────────────────────────────────────────
// Chairman only
const deleteAmenity = async (req, res) => {
  const { society_id } = req.user;
  const { id } = req.params;

  try {
    const [[existing]] = await db.query(
      `SELECT id, image FROM amenities WHERE id = ? AND society_id = ?`,
      [id, society_id],
    );
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Amenity not found." });
    }

    await db.query(`DELETE FROM amenities WHERE id = ?`, [id]);

    // Delete image file from disk
    if (existing.image) _deleteFile(_absolutePath(existing.image));

    return res.json({ success: true, message: "Amenity deleted." });
  } catch (err) {
    console.error("[Amenity] deleteAmenity error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── PUT /api/amenities/status/:id ─────────────────────────────────────────────
// Chairman only — toggle ACTIVE ↔ INACTIVE
const toggleStatus = async (req, res) => {
  const { society_id } = req.user;
  const { id } = req.params;

  try {
    const [[existing]] = await db.query(
      `SELECT id, status FROM amenities WHERE id = ? AND society_id = ?`,
      [id, society_id],
    );
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Amenity not found." });
    }

    const newStatus = existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    await db.query(`UPDATE amenities SET status = ? WHERE id = ?`, [
      newStatus,
      id,
    ]);

    return res.json({
      success: true,
      message: `Amenity ${newStatus === "ACTIVE" ? "activated" : "deactivated"}.`,
      status: newStatus,
    });
  } catch (err) {
    console.error("[Amenity] toggleStatus error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function _absolutePath(relativePath) {
  return path.join(__dirname, "..", relativePath);
}

function _deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn("[Amenity] Could not delete file:", filePath, e.message);
  }
}

module.exports = {
  getAmenities,
  getDashboard,
  getAmenityById,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  toggleStatus,
};
