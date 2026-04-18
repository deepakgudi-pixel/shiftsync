const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*, COUNT(s.id) FILTER (WHERE s.status IN ('ASSIGNED','IN_PROGRESS')) as active_shifts
       FROM members m LEFT JOIN shifts s ON m.id = s.assignee_id
       WHERE m.organisation_id = $1 GROUP BY m.id ORDER BY m.name`,
      [req.member.organisation_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch members" }); }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [member, avail, notifs] = await Promise.all([
      query(`SELECT m.*, o.name as org_name FROM members m JOIN organisations o ON m.organisation_id = o.id WHERE m.id = $1`, [req.member.id]),
      query("SELECT * FROM availability WHERE member_id = $1 ORDER BY day_of_week", [req.member.id]),
      query("SELECT * FROM notifications WHERE member_id = $1 AND read = FALSE ORDER BY created_at DESC LIMIT 10", [req.member.id]),
    ]);
    res.json({ ...member.rows[0], availability: avail.rows, notifications: notifs.rows });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.post("/onboard", async (req, res) => {
  try {
    const { clerkUserId, email, name, organisationId, organisationName } = req.body;
    let orgId = organisationId;
    if (!orgId && organisationName) {
      const slug = `${organisationName.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")}-${Date.now()}`;
      const org = await query("INSERT INTO organisations (name, slug) VALUES ($1,$2) RETURNING id", [organisationName, slug]);
      orgId = org.rows[0].id;
    }
    if (!orgId) return res.status(400).json({ error: "Organisation required" });
    const existing = await query("SELECT * FROM members WHERE clerk_user_id = $1", [clerkUserId]);
    if (existing.rows.length) return res.json(existing.rows[0]);
    const count = await query("SELECT COUNT(*) FROM members WHERE organisation_id = $1", [orgId]);
    const isFirst = parseInt(count.rows[0].count) === 0;
    const result = await query(
      "INSERT INTO members (clerk_user_id, email, name, role, organisation_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [clerkUserId, email, name, isFirst ? "ADMIN" : "EMPLOYEE", orgId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to onboard" }); }
});

router.put("/me", requireAuth, async (req, res) => {
  try {
    const { name, phone, skills, hourlyRate } = req.body;
    const result = await query(
      `UPDATE members SET name=COALESCE($1,name), phone=COALESCE($2,phone),
       skills=COALESCE($3,skills), hourly_rate=COALESCE($4,hourly_rate), updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [name, phone, skills, hourlyRate, req.member.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed to update" }); }
});

router.put("/me/availability", requireAuth, async (req, res) => {
  try {
    const { availability } = req.body;
    await query("DELETE FROM availability WHERE member_id = $1", [req.member.id]);
    for (const a of availability) {
      await query("INSERT INTO availability (member_id,day_of_week,start_time,end_time) VALUES ($1,$2,$3,$4)",
        [req.member.id, a.dayOfWeek, a.startTime, a.endTime]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.patch("/:id/role", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const result = await query(
      "UPDATE members SET role=$1, updated_at=NOW() WHERE id=$2 AND organisation_id=$3 RETURNING *",
      [req.body.role, req.params.id, req.member.organisation_id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    if (req.params.id === req.member.id) return res.status(400).json({ error: "Cannot remove yourself" });
    await query("DELETE FROM members WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
