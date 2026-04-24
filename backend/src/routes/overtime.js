const router = require("express").Router();
const { pool } = require("../db/client");
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");
const { emitEvent } = require("../lib/eventEmitter");
const { EVENT_TYPES } = require("../lib/events");

router.get("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM overtime_rules WHERE organisation_id=$1 ORDER BY created_at DESC`,
      [req.member.organisation_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch rules" }); }
});

router.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active } = req.body;

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO overtime_rules (organisation_id, name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.member.organisation_id, name || "Default Overtime Rule",
       daily_threshold_hours || 8, weekly_threshold_hours || 40,
       daily_multiplier || 1.5, weekly_multiplier || 1.5, is_active !== false]
    );

    await emitEvent({
      client,
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType: EVENT_TYPES.OVERTIME_RULE_CREATED,
      entityType: "overtime_rule",
      entityId: result.rows[0].id,
      payload: result.rows[0],
    });

    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "CREATE", entityType: "overtime_rule", entityId: result.rows[0].id, newValues: result.rows[0], req });

    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to create rule" });
  } finally {
    client.release();
  }
});

router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT * FROM overtime_rules WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Rule not found" });
    }

    const { name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active } = req.body;
    const result = await client.query(
      `UPDATE overtime_rules SET name=$1, daily_threshold_hours=$2, weekly_threshold_hours=$3, daily_multiplier=$4, weekly_multiplier=$5, is_active=$6 WHERE id=$7 RETURNING *`,
      [name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active, req.params.id]
    );

    await emitEvent({
      client,
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType: EVENT_TYPES.OVERTIME_RULE_UPDATED,
      entityType: "overtime_rule",
      entityId: req.params.id,
      payload: { before: existing.rows[0], after: result.rows[0] },
    });

    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "UPDATE", entityType: "overtime_rule", entityId: req.params.id, oldValues: existing.rows[0], newValues: result.rows[0], req });

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to update rule" });
  } finally {
    client.release();
  }
});

router.delete("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT * FROM overtime_rules WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Rule not found" });
    }

    await emitEvent({
      client,
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType: EVENT_TYPES.OVERTIME_RULE_DELETED,
      entityType: "overtime_rule",
      entityId: req.params.id,
      payload: existing.rows[0],
    });

    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "DELETE", entityType: "overtime_rule", entityId: req.params.id, oldValues: existing.rows[0], req });

    await client.query("DELETE FROM overtime_rules WHERE id=$1", [req.params.id]);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to delete rule" });
  } finally {
    client.release();
  }
});

module.exports = router;