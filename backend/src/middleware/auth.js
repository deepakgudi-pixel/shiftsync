const Clerk = require("@clerk/backend");
const { query } = require("../db/client");
const { logAudit } = require("../lib/audit");

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      await logAudit({
        organisationId: null,
        memberId: null,
        clerkUserId: null,
        action: "REQUEST",
        entityType: "MEMBER",
        entityId: null,
        oldValues: null,
        newValues: { reason: "missing_token", ip: req.ip },
        req,
      }).catch(() => {});
      return res.status(401).json({ error: "No token" });
    }
    const token = authHeader.split(" ")[1];

    const { verifyToken } = Clerk;
    let payload;
    try {
      payload = await verifyToken(token, {
        jwtKey: process.env.CLERK_JWT_KEY,
      });
    } catch (verifyErr) {
      await logAudit({
        organisationId: null,
        memberId: null,
        clerkUserId: null,
        action: "REQUEST",
        entityType: "MEMBER",
        entityId: null,
        oldValues: null,
        newValues: { reason: "invalid_token", ip: req.ip, error: verifyErr.message },
        req,
      }).catch(() => {});
      return res.status(401).json({ error: "Invalid token" });
    }

    const clerkUserId = payload.sub;

    const result = await query(
      `SELECT m.*, o.name as org_name, o.slug as org_slug
       FROM members m JOIN organisations o ON m.organisation_id = o.id
       WHERE m.clerk_user_id = $1`,
      [clerkUserId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Member not found. Complete onboarding." });
    }

    req.member = result.rows[0];
    req.clerkUserId = clerkUserId;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ error: "Invalid token", detail: err.message });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.member?.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  next();
};

module.exports = { requireAuth, requireRole };