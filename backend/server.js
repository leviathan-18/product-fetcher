const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const productRoutes = require("./routes/productRoutes");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware for JSON body parsing and CORS support.
app.use(express.json({ limit: "1mb" }));
app.use(cors());
app.use((req, _res, next) => {
  req.requestStartTime = Date.now();
  next();
});
app.use((req, res, next) => {
  res.on("finish", () => {
    const duration = Date.now() - (req.requestStartTime || Date.now());
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} status=${res.statusCode} durationMs=${duration}`
    );
  });
  next();
});

// Health endpoint to verify the backend is up.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "Backend is running" });
});

// Product scraping routes.
app.use("/api/products", productRoutes);

// Fallback for unknown routes.
app.use((_req, res) => {
  res.status(404).json({ success: false, status: "failed", message: "Route not found" });
});

// Global error handler for uncaught route errors.
app.use((err, _req, res, _next) => {
  console.error("Unhandled server error:", err);
  res.status(err.statusCode || 500).json({
    success: false,
    status: "failed",
    message: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
