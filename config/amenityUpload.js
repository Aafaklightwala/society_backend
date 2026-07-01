// config/amenityUpload.js
// ─────────────────────────────────────────────────────────────────────────────
//  Multer config for amenity images
//  Saves to uploads/amenities/<uuid>.<ext>
// ─────────────────────────────────────────────────────────────────────────────

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "amenities");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, or WEBP images are allowed."));
  }
};

const amenityUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

function relativeAmenityPhotoPath(filename) {
  return `uploads/amenities/${filename}`;
}

module.exports = { amenityUpload, relativeAmenityPhotoPath, UPLOAD_DIR };
