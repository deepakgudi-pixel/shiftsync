const router = require("express").Router();
const { pool } = require("../db/client");
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");
const { emitEvent } = require("../lib/eventEmitter");
const { EVENT_TYPES } = require("../lib/events");
const {
  DEFAULT_OVERTIME_RULE,
  calculatePayrollTotals,
  normalizeOvertimeRule,
} = require("../lib/payrollCalculations");

// Helper: fetch all shifts with clock events for an org within a date range — single query
const fetchAllShiftsForPeriod = async (orgId, startDate, endDate) => {
  const result = await query(`
    SELECT
      s.assignee_id,
      DATE(ci.timestamp AT TIME ZONE 'UTC') as shift_date,
      EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp))/3600 as raw_hours
    FROM shifts s
    JOIN clock_events ci ON s.id = ci.shift_id AND ci.type = 'CLOCK_IN'
    JOIN clock_events co ON s.id = co.shift_id AND co.type = 'CLOCK_OUT'
    WHERE s.organisation_id = $1
      AND s.status = 'COMPLETED'
      AND ci.timestamp >= $2::date
      AND ci.timestamp <= ($3::date + INTERVAL '1 day')
  `, [orgId, startDate, endDate]);
  return result.rows;
};

// List pay periods
router.get("/pay-periods", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT pp.*, COUNT(p.id) as payslip_count,
       COALESCE((SELECT SUM(total_earnings) FROM payslips WHERE pay_period_id=pp.id), 0) as total_cost
       FROM pay_periods pp
       LEFT JOIN payslips p ON pp.id=p.pay_period_id
       WHERE pp.organisation_id=$1
       GROUP BY pp.id ORDER BY pp.start_date DESC`,
      [req.member.organisation_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// Create pay period
router.post("/pay-periods", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { period_type, start_date, end_date } = req.body;
    if (!period_type || !start_date || !end_date) return res.status(400).json({ error: "Missing fields" });
    const result = await query(
      `INSERT INTO pay_periods (organisation_id, period_type, start_date, end_date) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.member.organisation_id, period_type, start_date, end_date]
    );
    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "CREATE", entityType: "pay_period", entityId: result.rows[0].id, newValues: result.rows[0], req });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed to create pay period" }); }
});

// Get timesheet for a pay period (with overtime calculation)
router.get("/pay-periods/:id/timesheet", requireAuth, async (req, res) => {
  try {
    const period = await query("SELECT * FROM pay_periods WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!period.rows.length) return res.status(404).json({ error: "Pay period not found" });

    const rules = await query("SELECT * FROM overtime_rules WHERE organisation_id=$1 AND is_active=true LIMIT 1", [req.member.organisation_id]);
    const rule = normalizeOvertimeRule(rules.rows[0] || DEFAULT_OVERTIME_RULE);

    // Single query: all employees with their rate overrides
    const empResult = await query(`
      SELECT m.id, m.name, m.avatar_url, m.hourly_rate,
        er.hourly_rate as override_rate,
        COALESCE(er.overtime_multiplier, $2) as ot_multiplier
      FROM members m
      LEFT JOIN LATERAL (SELECT * FROM employee_rates WHERE member_id=m.id AND effective_from <= $3 ORDER BY effective_from DESC LIMIT 1) er ON true
      WHERE m.organisation_id=$1 AND m.role='EMPLOYEE'
    `, [req.member.organisation_id, rule.daily_multiplier, period.rows[0].end_date]);

    // Single query: all shifts + clock events for all employees in the period
    const shiftRows = await fetchAllShiftsForPeriod(
      req.member.organisation_id,
      period.rows[0].start_date,
      period.rows[0].end_date
    );

    // Group shifts by employee
    const shiftsByEmp = {};
    for (const row of shiftRows) {
      if (!row.assignee_id) continue;
      if (!shiftsByEmp[row.assignee_id]) shiftsByEmp[row.assignee_id] = [];
      shiftsByEmp[row.assignee_id].push(row);
    }

    const employees = empResult.rows.map(emp => {
      const empShifts = shiftsByEmp[emp.id] || [];

      // Build daily hours map
      const byDay = {};
      for (const s of empShifts) {
        const h = Math.max(0, parseFloat(s.raw_hours) || 0);
        const day = s.shift_date;
        byDay[day] = (byDay[day] || 0) + h;
      }

      const dailyHours = Object.values(byDay);
      const payroll = calculatePayrollTotals({
        dailyHours,
        hourlyRate: parseFloat(emp.override_rate) || parseFloat(emp.hourly_rate) || 0,
        overtimeMultiplier: parseFloat(emp.ot_multiplier) || parseFloat(rule.daily_multiplier),
        rule,
      });

      return {
        employeeId: emp.id,
        name: emp.name,
        avatarUrl: emp.avatar_url,
        hourlyRate: payroll.hourlyRate,
        shifts: empShifts.map(s => ({ date: s.shift_date, hours: Math.round((parseFloat(s.raw_hours) || 0) * 100) / 100 })),
        totalHours: payroll.totalHours,
        baseHours: payroll.baseHours,
        overtimeHours: payroll.overtimeHours,
        baseEarnings: payroll.baseEarnings,
        overtimeEarnings: payroll.overtimeEarnings,
        totalEarnings: payroll.totalEarnings,
      };
    });

    res.json({ period: period.rows[0], rule, employees });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// Summary for a pay period
router.get("/pay-periods/:id/summary", requireAuth, async (req, res) => {
  try {
    const period = await query("SELECT * FROM pay_periods WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!period.rows.length) return res.status(404).json({ error: "Not found" });

    const rules = await query("SELECT * FROM overtime_rules WHERE organisation_id=$1 AND is_active=true LIMIT 1", [req.member.organisation_id]);
    const rule = normalizeOvertimeRule(rules.rows[0] || DEFAULT_OVERTIME_RULE);

    // Single query: all employee rates
    const empResult = await query(`
      SELECT m.id, m.name,
        er.hourly_rate as override_rate, m.hourly_rate,
        COALESCE(er.overtime_multiplier, $2) as ot_mult
      FROM members m
      LEFT JOIN LATERAL (SELECT * FROM employee_rates WHERE member_id=m.id AND effective_from <= $3 ORDER BY effective_from DESC LIMIT 1) er ON true
      WHERE m.organisation_id=$1 AND m.role='EMPLOYEE'
    `, [req.member.organisation_id, rule.daily_multiplier, period.rows[0].end_date]);

    // Single query: all completed shifts within the period
    const shiftRows = await fetchAllShiftsForPeriod(
      req.member.organisation_id,
      period.rows[0].start_date,
      period.rows[0].end_date
    );

    // Build daily hours per employee
    const byEmp = {};
    for (const row of shiftRows) {
      if (!row.assignee_id) continue;
      if (!byEmp[row.assignee_id]) byEmp[row.assignee_id] = {};
      const day = row.shift_date;
      byEmp[row.assignee_id][day] = (byEmp[row.assignee_id][day] || 0) + Math.max(0, parseFloat(row.raw_hours) || 0);
    }

    let totalBase = 0, totalOT = 0, totalHours = 0, empCount = 0;
    const summary = [];

    for (const emp of empResult.rows) {
      const dailyMap = byEmp[emp.id] || {};
      const dailyHours = Object.values(dailyMap);
      if (dailyHours.length === 0) continue;

      const payroll = calculatePayrollTotals({
        dailyHours,
        hourlyRate: parseFloat(emp.override_rate) || parseFloat(emp.hourly_rate) || 0,
        overtimeMultiplier: parseFloat(emp.ot_mult),
        rule,
      });

      totalBase += payroll.baseEarnings;
      totalOT += payroll.overtimeEarnings;
      totalHours += payroll.totalHours;
      empCount++;
      summary.push({
        empId: emp.id,
        name: emp.name,
        rate: payroll.hourlyRate,
        totalHours: payroll.totalHours,
        overtimeHours: payroll.overtimeHours,
        baseEarn: payroll.baseEarnings,
        otEarn: payroll.overtimeEarnings,
      });
    }

    res.json({
      employeeCount: empCount,
      totalHours: Math.round(totalHours * 100) / 100,
      totalBaseEarnings: Math.round(totalBase * 100) / 100,
      totalOvertimeEarnings: Math.round(totalOT * 100) / 100,
      totalCost: Math.round((totalBase + totalOT) * 100) / 100,
      rule,
      breakdown: summary,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// Process pay period: lock and generate payslips
router.post("/pay-periods/:id/process", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const client = await pool.connect();
  try {
    const period = await query("SELECT * FROM pay_periods WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!period.rows.length) return res.status(404).json({ error: "Pay period not found" });
    if (period.rows[0].status !== "DRAFT") return res.status(400).json({ error: "Period already processed" });

    // Idempotency: if snapshots already exist, return cached results
    const existingSnapshots = await client.query(
      "SELECT COUNT(*) FROM payroll_snapshots WHERE pay_period_id=$1",
      [req.params.id]
    );
    if (parseInt(existingSnapshots.rows[0].count) > 0) {
      const snapshots = await client.query(`
        SELECT ps.*, m.name, m.avatar_url
        FROM payroll_snapshots ps
        JOIN members m ON ps.member_id = m.id
        WHERE ps.pay_period_id = $1
        ORDER BY m.name
      `, [req.params.id]);

      const payslips = await client.query(
        "SELECT * FROM payslips WHERE pay_period_id=$1",
        [req.params.id]
      );

      return res.json({
        cached: true,
        message: "Pay period was already processed",
        snapshots: snapshots.rows,
        payslips: payslips.rows,
      });
    }

    const org = await client.query("SELECT currency FROM organisations WHERE id=$1", [req.member.organisation_id]);
    const currency = org.rows[0]?.currency || "USD";

    // Capture current rules and rates — frozen at processing time
    const rules = await client.query("SELECT * FROM overtime_rules WHERE organisation_id=$1 AND is_active=true LIMIT 1", [req.member.organisation_id]);
    const rule = {
      id: rules.rows[0]?.id || null,
      ...normalizeOvertimeRule(rules.rows[0] || DEFAULT_OVERTIME_RULE),
    };

    const empResult = await client.query(`
      SELECT m.id, m.name,
        er.hourly_rate as override_rate, m.hourly_rate,
        COALESCE(er.overtime_multiplier, $2) as ot_mult
      FROM members m
      LEFT JOIN LATERAL (SELECT * FROM employee_rates WHERE member_id=m.id AND effective_from <= $3 ORDER BY effective_from DESC LIMIT 1) er ON true
      WHERE m.organisation_id=$1 AND m.role='EMPLOYEE'
    `, [req.member.organisation_id, rule.daily_multiplier, period.rows[0].end_date]);

    const shiftRows = await fetchAllShiftsForPeriod(
      req.member.organisation_id,
      period.rows[0].start_date,
      period.rows[0].end_date
    );

    const shiftsByEmp = {};
    for (const row of shiftRows) {
      if (!row.assignee_id) continue;
      if (!shiftsByEmp[row.assignee_id]) shiftsByEmp[row.assignee_id] = [];
      shiftsByEmp[row.assignee_id].push(row);
    }

    const generated = [];
    const skipped = [];

    for (const emp of empResult.rows) {
      const hourlyRate = parseFloat(emp.override_rate) || parseFloat(emp.hourly_rate) || 0;

      if (hourlyRate <= 0) {
        skipped.push({ id: emp.id, name: emp.name, reason: "No hourly rate set" });
        continue;
      }

      const empShifts = shiftsByEmp[emp.id] || [];
      if (empShifts.length === 0) {
        skipped.push({ id: emp.id, name: emp.name, reason: "No completed shifts in this period" });
        continue;
      }

      const byDay = {};
      for (const s of empShifts) {
        const h = Math.max(0, parseFloat(s.raw_hours) || 0);
        const day = s.shift_date;
        byDay[day] = (byDay[day] || 0) + h;
      }

      const dailyHours = Object.values(byDay);
      const payroll = calculatePayrollTotals({
        dailyHours,
        hourlyRate,
        overtimeMultiplier: parseFloat(emp.ot_mult) || parseFloat(rule.daily_multiplier),
        rule,
      });

      // Capture snapshot BEFORE payslip
      await client.query(`
        INSERT INTO payroll_snapshots (
          pay_period_id, organisation_id, member_id,
          hourly_rate, effective_rate_id, overtime_multiplier,
          rule_id, rule_daily_threshold_hours, rule_weekly_threshold_hours,
          rule_daily_multiplier, rule_weekly_multiplier,
          total_hours, base_hours, overtime_hours,
          base_earnings, overtime_earnings, total_earnings,
          generated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      `, [
        req.params.id, req.member.organisation_id, emp.id,
        hourlyRate, emp.override_rate ? emp.id : null, payroll.overtimeMultiplier,
        rule.id || null, rule.daily_threshold_hours, rule.weekly_threshold_hours,
        rule.daily_multiplier, rule.weekly_multiplier,
        payroll.totalHours, payroll.baseHours, payroll.overtimeHours,
        payroll.baseEarnings, payroll.overtimeEarnings, payroll.totalEarnings,
        req.member.id,
      ]);

      const result = await client.query(
        `INSERT INTO payslips (member_id, pay_period_id, organisation_id, base_hours, overtime_hours, overtime_rate, base_earnings, overtime_earnings, total_earnings, currency, generated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [emp.id, req.params.id, req.member.organisation_id,
         payroll.baseHours, payroll.overtimeHours, payroll.overtimeMultiplier,
         payroll.baseEarnings, payroll.overtimeEarnings,
         payroll.totalEarnings, currency, req.member.id]
      );
      generated.push({ id: result.rows[0].id, name: emp.name, totalEarn: payroll.totalEarnings });
    }

    await client.query("UPDATE pay_periods SET status='PROCESSED', processed_at=NOW() WHERE id=$1", [req.params.id]);

    await emitEvent({
      client,
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType: EVENT_TYPES.PAY_PERIOD_PROCESSED,
      entityType: "pay_period",
      entityId: req.params.id,
      payload: { generated: generated.length, skipped: skipped.length },
      req,
    });

    await logAudit({
      organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId,
      action: "UPDATE", entityType: "pay_period", entityId: req.params.id,
      newValues: { status: "PROCESSED", payslipsGenerated: generated.length }, req
    });

    res.json({
      success: true,
      payslipsGenerated: generated.length,
      generated,
      skipped,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process period" });
  } finally {
    client.release();
  }
});

// Mark period as paid
router.post("/pay-periods/:id/paid", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await query("UPDATE pay_periods SET status='PAID' WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "UPDATE", entityType: "pay_period", entityId: req.params.id, newValues: { status: "PAID" }, req });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// Delete payslips for a period (to allow reprocessing)
router.delete("/pay-periods/:id/payslips", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM payroll_snapshots WHERE pay_period_id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
      const result = await client.query("DELETE FROM payslips WHERE pay_period_id=$1 AND organisation_id=$2 RETURNING id", [req.params.id, req.member.organisation_id]);
      await client.query("UPDATE pay_periods SET status='DRAFT', processed_at=NULL WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
      await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "DELETE", entityType: "payslip_batch", entityId: req.params.id, oldValues: { count: result.rowCount }, req });
      await client.query("COMMIT");
      res.json({ success: true, deleted: result.rowCount });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// Employee rate overrides
router.get("/employee-rates", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { memberId } = req.query;
    if (!memberId) return res.status(400).json({ error: "memberId required" });
    const result = await query("SELECT * FROM employee_rates WHERE member_id=$1 ORDER BY effective_from DESC LIMIT 1", [memberId]);
    res.json(result.rows[0] || {});
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.post("/employee-rates", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { member_id, hourly_rate, overtime_multiplier, effective_from } = req.body;
    if (!member_id || !hourly_rate || !effective_from) return res.status(400).json({ error: "Missing fields" });
    const result = await query(
      `INSERT INTO employee_rates (member_id, hourly_rate, overtime_multiplier, effective_from) VALUES ($1,$2,$3,$4) RETURNING *`,
      [member_id, hourly_rate, overtime_multiplier || 1.5, effective_from]
    );
    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "CREATE", entityType: "employee_rate", entityId: result.rows[0].id, newValues: result.rows[0], req });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
