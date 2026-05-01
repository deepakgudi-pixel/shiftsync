const router = require("express").Router();
const { createClerkClient } = require("@clerk/backend");
const { query } = require("../db/client");

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const isDemoAccessEnabled = () => process.env.DEMO_ACCESS_ENABLED === "true";

const isLocalDevelopment = (req) => {
  const host = (req.headers.host || "").toLowerCase();
  return process.env.NODE_ENV === "development" && (host.includes("localhost") || host.includes("127.0.0.1"));
};

const requireDemoAccess = (req, res, next) => {
  if (!isLocalDevelopment(req) && !isDemoAccessEnabled()) {
    return res.status(404).json({ error: "Not found" });
  }
  next();
};

const DEMO_EMAILS = [
  "demo.admin.northstar+clerk_test@example.com",
  "demo.manager.northstar+clerk_test@example.com",
  "demo.leah.northstar+clerk_test@example.com",
  "demo.nina.northstar+clerk_test@example.com",
  "demo.owen.northstar+clerk_test@example.com",
];

router.get("/demo-users", requireDemoAccess, async (_req, res) => {
  try {
    const result = await query(
      `SELECT role, name, email
       FROM members
       WHERE email = ANY($1::text[])
       ORDER BY CASE role WHEN 'ADMIN' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END, name`,
      [DEMO_EMAILS]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch demo users", error);
    res.status(500).json({ error: "Failed to fetch demo users" });
  }
});

router.post("/demo-ticket", requireDemoAccess, async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email || !DEMO_EMAILS.includes(email)) {
      return res.status(400).json({ error: "Unknown demo account" });
    }

    const memberResult = await query(
      "SELECT clerk_user_id, role, name, email FROM members WHERE email = $1 LIMIT 1",
      [email]
    );
    const member = memberResult.rows[0];

    if (!member?.clerk_user_id) {
      return res.status(404).json({ error: "Demo account not found" });
    }

    const signInToken = await clerk.signInTokens.createSignInToken({
      userId: member.clerk_user_id,
      expiresInSeconds: 60 * 5,
    });

    res.json({
      email: member.email,
      name: member.name,
      role: member.role,
      ticket: signInToken.token,
      expiresAt: signInToken.expiresAt,
    });
  } catch (error) {
    console.error("Failed to create demo sign-in ticket", error);
    res.status(500).json({ error: "Failed to create demo access ticket" });
  }
});

module.exports = router;
