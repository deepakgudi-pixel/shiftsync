const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");

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
  try {
    const { name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active } = req.body;
    const result = await query(
      `INSERT INTO overtime_rules (organisation_id, name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.member.organisation_id, name || "Default Overtime Rule",
       daily_threshold_hours || 8, weekly_threshold_hours || 40,
       daily_multiplier || 1.5, weekly_multiplier || 1.5, is_active !== false]
    );
    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "CREATE", entityType: "overtime_rule", entityId: result.rows[0].id, newValues: result.rows[0], req });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed to create rule" }); }
});

router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const existing = await query("SELECT * FROM overtime_rules WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Rule not found" });
    const { name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active } = req.body;
    const result = await query(
      `UPDATE overtime_rules SET name=$1, daily_threshold_hours=$2, weekly_threshold_hours=$3, daily_multiplier=$4, weekly_multiplier=$5, is_active=$6 WHERE id=$7 RETURNING *`,
      [name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active, req.params.id]
    );
    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "UPDATE", entityType: "overtime_rule", entityId: req.params.id, oldValues: existing.rows[0], newValues: result.rows[0], req });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed to update rule" }); }
});

router.delete("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const existing = await query("SELECT * FROM overtime_rules WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Rule not found" });
    await query("DELETE FROM overtime_rules WHERE id=$1", [req.params.id]);
    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "DELETE", entityType: "overtime_rule", entityId: req.params.id, oldValues: existing.rows[0], req });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete rule" }); }
});

module.exports = router;