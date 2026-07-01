const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// ── Middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});
require("./socket/socket")(io);

app.set("io", io);

// ── Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/dashboard", require("./routes/dashboard.routes"));
app.use("/api/visitors", require("./routes/visitor.routes"));
app.use("/api/maintenance", require("./routes/maintenance.routes"));
app.use("/api/complaints", require("./routes/complaint.routes"));
app.use("/api/amenities", require("./routes/amenity.routes"));
app.use("/api/residents", require("./routes/residents.routes"));
app.use("/api/intercom", require("./routes/intercom.routes"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/visitors", require("./routes/visitor.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));

// ── Health check ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "Society ERP API is running ✅", version: "1.0.0" });
});

// ── 404 handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error." });
});

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO ready for WebRTC signaling`);
});
