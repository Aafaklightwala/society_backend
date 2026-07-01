// config/visitorUpload.js
// ─────────────────────────────────────────────────────────────────────────────
//  Multer storage config for visitor photos
//  Saves to uploads/visitors/<uuid>.<ext> — never stores blobs in MySQL
// ─────────────────────────────────────────────────────────────────────────────

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "visitors");

// Ensure the directory exists
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

const visitorUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Helper to build the relative path stored in DB (and served statically)
function relativeVisitorPhotoPath(filename) {
  return `uploads/visitors/${filename}`;
}

module.exports = { visitorUpload, relativeVisitorPhotoPath, UPLOAD_DIR };
