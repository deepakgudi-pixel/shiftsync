const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const express = require("express");
const http = require("http");
const cors = require("cors");

const parseOrigins = (...values: Array<string | undefined>) => Array.from(new Set(
  values
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
));

// FRONTEND_URL is the primary deployed client. FRONTEND_URLS is optional for
// previews, migrations, or multiple branded domains during a rollout.
const allowedOrigins = parseOrigins(
  process.env.FRONTEND_URL || "http://localhost:3000",
  process.env.FRONTEND_URLS
);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`), false);
  },
  credentials: true,
};
const rateLimit = /** @type {any} */ (require("express-rate-limit"));
const { ipKeyGenerator } = /** @type {any} */ (require("express-rate-limit"));
const helmet = /** @type {any} */ (require("helmet"));
const { Server } = require("socket.io");
const { routes } = require("./routes");
const { initSocket } = require("./socket");

const app = express();
const server = http.createServer(app);

// Trust proxy for correct req.ip behind reverse proxies (Nginx, ALB, etc.)
app.set("trust proxy", 1);

const io = new Server(server, {
  cors: corsOptions,
});

// Security headers — must be first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...allowedOrigins],
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

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

app.use((req, _, next) => { req.io = io; next(); });
app.get("/health", (_, res) => res.json({ status: "ok", ts: new Date() }));

// Coarse IP rate limiting for all API traffic. Authenticated routes apply a
// per-member limiter inside requireAuth after req.member is available.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
});
app.use("/api", apiLimiter);

for (const route of routes) {
  app.use(route.path, route.router);
}

// Global error handler — catches unhandled errors and prevents stack trace leaks
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err.message, err.stack);
  res.status(500).json({ error: "Internal server error" });
});
initSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Relay API running on http://localhost:${PORT}`));

export {};
