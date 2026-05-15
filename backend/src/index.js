const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const express = require("express");
const http = require("http");
const cors = require("cors");
const rateLimit = /** @type {any} */ (require("express-rate-limit"));
const helmet = /** @type {any} */ (require("helmet"));
const { Server } = require("socket.io");
const { initSocket } = require("./socket");

const app = express();
const server = http.createServer(app);

// Trust proxy for correct req.ip behind reverse proxies (Nginx, ALB, etc.)
app.set("trust proxy", 1);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true },
});

// Security headers — must be first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: "deny" },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.use((req, _, next) => { req.io = io; next(); });
app.get("/health", (_, res) => res.json({ status: "ok", ts: new Date() }));
app.use("/api/members", require("./routes/members"));
app.use("/api/organisations", require("./routes/organisations"));
app.use("/api/shifts", require("./routes/shifts"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/audit-logs", require("./routes/audit"));
app.use("/api/overtime", require("./routes/overtime"));
app.use("/api/payroll", require("./routes/payroll"));
app.use("/api/payslips", require("./routes/payslips"));
app.use("/api/events", require("./routes/events"));
app.use("/api/dev", require("./routes/dev"));

// Global rate limiting — placed after routes so auth middleware has populated req.member
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.member?.role === "ADMIN",
});
app.use("/api", apiLimiter);

// Global error handler — catches unhandled errors and prevents stack trace leaks
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err.message, err.stack);
  res.status(500).json({ error: "Internal server error" });
});
initSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`ShiftSync API running on http://localhost:${PORT}`));
