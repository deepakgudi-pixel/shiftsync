const router = require("express").Router();
const { pool } = require("../db/client");
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");
const { emitEvent } = require("../lib/eventEmitter");
const { EVENT_TYPES } = require("../lib/events");

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT m.id, m.name, m.email, m.role, m.phone, m.skills, m.avatar_url, m.organisation_id, m.can_manage_rates, m.created_at, m.updated_at,
       CASE WHEN $2 = 'ADMIN' OR m.id = $3 OR ($2 = 'MANAGER' AND m.role = 'EMPLOYEE') THEN m.hourly_rate ELSE NULL END as hourly_rate,
       (SELECT COUNT(*) FROM shifts s WHERE s.assignee_id = m.id AND s.status IN ('ASSIGNED','IN_PROGRESS') AND s.organisation_id = $1) as active_shifts
       FROM members m
       WHERE m.organisation_id = $1 ORDER BY m.name`,
      [req.member.organisation_id, req.member.role, req.member.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch members" }); }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [member, avail, notifs] = await Promise.all([
      query(`SELECT m.*, o.name as org_name, o.allow_manager_rates
             FROM members m JOIN organisations o ON m.organisation_id = o.id WHERE m.id = $1`, [req.member.id]),
      query("SELECT * FROM availability WHERE member_id = $1 ORDER BY day_of_week", [req.member.id]),
      query("SELECT * FROM notifications WHERE member_id = $1 AND read = FALSE ORDER BY created_at DESC LIMIT 10", [req.member.id]),
    ]);
    if (!member.rows[0]) return res.status(404).json({ error: "Member not found" });
    res.json({ ...member.rows[0], availability: avail.rows, notifications: notifs.rows });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.post("/onboard", async (req, res) => {
  const client = await pool.connect();
  try {
    const { clerkUserId, email, name, organisationId, organisationName } = req.body;
    let orgId = organisationId;

    await client.query("BEGIN");

    if (!orgId && organisationName) {
      const slug = `${organisationName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}-${Date.now()}`;
      const org = await client.query("INSERT INTO organisations (name, slug) VALUES ($1, $2) RETURNING *", [organisationName, slug]);
      orgId = org.rows[0].id;
    }
    if (!orgId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Organisation required" });
    }

    const existing = await client.query("SELECT * FROM members WHERE clerk_user_id = $1", [clerkUserId]);
    if (existing.rows.length) {
      await client.query("COMMIT");
      return res.json(existing.rows[0]);
    }

    const count = await client.query("SELECT COUNT(*) FROM members WHERE organisation_id = $1", [orgId]);
    const isFirst = parseInt(count.rows[0].count) === 0;

    const result = await client.query(
      "INSERT INTO members (clerk_user_id, email, name, role, organisation_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [clerkUserId, email, name, isFirst ? "ADMIN" : "EMPLOYEE", orgId]
    );

    await emitEvent({
      client,
      organisationId: orgId,
      memberId: result.rows[0].id,
      eventType: EVENT_TYPES.MEMBER_JOINED,
      entityType: "member",
      entityId: result.rows[0].id,
      payload: result.rows[0],
    });

    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to onboard" });
  } finally {
    client.release();
  }
});

router.put("/me", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, phone, skills, hourlyRate } = req.body;

    await client.query("BEGIN");

    const existing = await client.query("SELECT * FROM members WHERE id = $1", [req.member.id]);

    const result = await client.query(
      `UPDATE members SET name=COALESCE($1,name), phone=COALESCE($2,phone),
       skills=COALESCE($3,skills), hourly_rate=COALESCE($4,hourly_rate), updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [
        name !== undefined ? name : null,
        phone !== undefined ? phone : null,
        skills !== undefined ? skills : null,
        hourlyRate !== undefined ? hourlyRate : null,
        req.member.id,
      ]
    );

    await emitEvent({
      client,
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType: EVENT_TYPES.MEMBER_UPDATED,
      entityType: "member",
      entityId: req.member.id,
      payload: { before: existing.rows[0], after: result.rows[0] },
    });

    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "UPDATE", entityType: "member", entityId: req.member.id, oldValues: existing.rows[0], newValues: result.rows[0], req });

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to update" });
  } finally {
    client.release();
  }
});

router.put("/me/availability", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { availability } = req.body;

    await client.query("BEGIN");
    await client.query("DELETE FROM availability WHERE member_id = $1", [req.member.id]);
    for (const a of availability) {
      await client.query(
        "INSERT INTO availability (member_id,day_of_week,start_time,end_time) VALUES ($1,$2,$3,$4)",
        [req.member.id, a.dayOfWeek, a.startTime, a.endTime]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed" });
  } finally {
    client.release();
  }
});

router.patch("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { role, hourly_rate, can_manage_rates } = req.body;

    if (req.member.role === 'MANAGER') {
      if (role !== undefined) return res.status(403).json({ error: "Managers cannot change member roles" });
      if (can_manage_rates !== undefined) return res.status(403).json({ error: "Managers cannot change permissions" });
      if (!req.member.can_manage_rates) return res.status(403).json({ error: "Manager rate editing is disabled for this organisation" });
      const target = await client.query("SELECT role FROM members WHERE id=$1", [req.params.id]);
      if (target.rows[0]?.role !== 'EMPLOYEE') return res.status(403).json({ error: "Managers can only set rates for employees" });
    }

    await client.query("BEGIN");

    const existing = await client.query("SELECT * FROM members WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Member not found" });
    }

    const result = await client.query(
      `UPDATE members SET role=COALESCE($1,role), hourly_rate=COALESCE($2,hourly_rate),
       can_manage_rates=COALESCE($3,can_manage_rates), updated_at=NOW()
       WHERE id=$4 AND organisation_id=$5 RETURNING *`,
      [
        role !== undefined ? role : null,
        hourly_rate !== undefined ? hourly_rate : null,
        can_manage_rates !== undefined ? can_manage_rates : null,
        req.params.id,
        req.member.organisation_id
      ]
    );

    await emitEvent({
      client,
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType: EVENT_TYPES.MEMBER_UPDATED,
      entityType: "member",
      entityId: req.params.id,
      payload: { before: existing.rows[0], after: result.rows[0] },
    });

    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "UPDATE",
      entityType: "member",
      entityId: req.params.id,
      oldValues: existing.rows[0],
      newValues: result.rows[0],
      req
    });

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to update member" });
  } finally {
    client.release();
  }
});

module.exports = router;