const router = require("express").Router();
const { createClerkClient } = require("@clerk/backend");
const { query } = require("../db/client");
const { seed } = require("../db/seed");
const { seedDemoData } = require("../db/seedDemoData");

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

router.post("/seed-demo-data", requireDemoAccess, async (req, res) => {
  try {
    await seedDemoData();
    res.json({ message: "Demo data seeded successfully" });
  } catch (error) {
    console.error("Failed to seed demo data", error);
    res.status(500).json({ error: "Failed to seed demo data" });
  }
});

router.post("/reset-demo", requireDemoAccess, async (req, res) => {
  try {
    const orgResult = await query(
      "SELECT id FROM organisations WHERE name = $1 LIMIT 1",
      ["Northstar Logistics"]
    );
    const organisationId = orgResult.rows[0]?.id;

    if (organisationId) {
      // Delete swap_requests via shift relationship
      await query("DELETE FROM swap_requests WHERE shift_id IN (SELECT id FROM shifts WHERE organisation_id = $1)", [organisationId]);
      // Delete clock_events via shift relationship
      await query("DELETE FROM clock_events WHERE shift_id IN (SELECT id FROM shifts WHERE organisation_id = $1)", [organisationId]);
      // Delete payslips via pay_periods relationship
      await query("DELETE FROM payslips WHERE pay_period_id IN (SELECT id FROM pay_periods WHERE organisation_id = $1)", [organisationId]);
      // Delete messages via members relationship
      await query("DELETE FROM messages WHERE sender_id IN (SELECT id FROM members WHERE organisation_id = $1)", [organisationId]);
      // Delete notifications via members relationship
      await query("DELETE FROM notifications WHERE member_id IN (SELECT id FROM members WHERE organisation_id = $1)", [organisationId]);
      // Now delete main tables with organisation_id
      await query("DELETE FROM shifts WHERE organisation_id = $1", [organisationId]);
      await query("DELETE FROM pay_periods WHERE organisation_id = $1", [organisationId]);
      await query("DELETE FROM announcements WHERE organisation_id = $1", [organisationId]);
      await query("DELETE FROM overtime_rules WHERE organisation_id = $1", [organisationId]);
    }

    // Re-seed demo data
    await seedDemoData();

    res.json({ message: "Demo data reset successfully" });
  } catch (error) {
    console.error("Failed to reset demo data", error);
    res.status(500).json({ error: "Failed to reset demo data" });
  }
});

module.exports = router;
