const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");

// List pay periods
router.get("/pay-periods", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT pp.*, COUNT(p.id) as payslip_count,
       (SELECT SUM(total_earnings) FROM payslips WHERE pay_period_id=pp.id) as total_cost
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
    const rule = rules.rows[0] || { daily_threshold_hours: 8, weekly_threshold_hours: 40, daily_multiplier: 1.5, weekly_multiplier: 1.5 };

    const employees = await query(`
      SELECT m.id, m.name, m.avatar_url, m.hourly_rate,
        er.hourly_rate as override_rate, er.overtime_multiplier as override_ot_mult
      FROM members m
      LEFT JOIN LATERAL (SELECT * FROM employee_rates WHERE member_id=m.id ORDER BY effective_from DESC LIMIT 1) er ON true
      WHERE m.organisation_id=$1 AND m.role='EMPLOYEE'
    `, [req.member.organisation_id]);

    const timesheetData = [];
    for (const emp of employees.rows) {
      const shifts = await query(`
        SELECT s.id, s.title, s.start_time,
          ci.timestamp as clock_in, co.timestamp as clock_out,
          EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp))/3600 as raw_hours
        FROM shifts s
        LEFT JOIN clock_events ci ON s.id=ci.shift_id AND ci.type='CLOCK_IN'
        LEFT JOIN clock_events co ON s.id=co.shift_id AND co.type='CLOCK_OUT'
        WHERE s.assignee_id=$1 AND s.status='COMPLETED'
          AND ci.timestamp >= $2::date AND ci.timestamp <= ($3::date + INTERVAL '1 day')
      `, [emp.id, period.rows[0].start_date, period.rows[0].end_date]);

      let totalHours = 0, overtimeHours = 0;
      const shiftDetails = shifts.rows.map(s => {
        const h = Math.max(0, parseFloat(s.raw_hours) || 0);
        totalHours += h;
        return { id: s.id, title: s.title, date: s.start_time, hours: Math.round(h * 100) / 100 };
      });

      // Daily overtime
      const byDay = {};
      shiftDetails.forEach(s => {
        const day = new Date(s.date).toDateString();
        byDay[day] = (byDay[day] || 0) + s.hours;
      });
      Object.values(byDay).forEach(h => {
        if (h > rule.daily_threshold_hours) overtimeHours += h - rule.daily_threshold_hours;
      });

      // Weekly overtime (simplified: total beyond weekly_threshold)
      const weeklyOT = Math.max(0, totalHours - rule.weekly_threshold_hours);
      overtimeHours = Math.max(overtimeHours, weeklyOT);

      const hourlyRate = parseFloat(emp.override_rate) || parseFloat(emp.hourly_rate) || 0;
      const otMult = parseFloat(emp.override_ot_mult) || parseFloat(rule.daily_multiplier);
      const baseHours = Math.max(0, totalHours - overtimeHours);
      const baseEarnings = baseHours * hourlyRate;
      const otEarnings = overtimeHours * hourlyRate * otMult;

      timesheetData.push({
        employeeId: emp.id,
        name: emp.name,
        avatarUrl: emp.avatar_url,
        hourlyRate,
        shifts: shiftDetails,
        totalHours: Math.round(totalHours * 100) / 100,
        baseHours: Math.round(baseHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        baseEarnings: Math.round(baseEarnings * 100) / 100,
        overtimeEarnings: Math.round(otEarnings * 100) / 100,
        totalEarnings: Math.round((baseEarnings + otEarnings) * 100) / 100,
      });
    }

    res.json({ period: period.rows[0], rule, employees: timesheetData });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// Summary for a pay period
router.get("/pay-periods/:id/summary", requireAuth, async (req, res) => {
  try {
    const period = await query("SELECT * FROM pay_periods WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!period.rows.length) return res.status(404).json({ error: "Not found" });

    const employees = await query(`
      SELECT m.id, m.name,
        er.hourly_rate as override_rate, m.hourly_rate,
        COALESCE(er.overtime_multiplier, 1.5) as ot_mult
      FROM members m
      LEFT JOIN LATERAL (SELECT * FROM employee_rates WHERE member_id=m.id ORDER BY effective_from DESC LIMIT 1) er ON true
      WHERE m.organisation_id=$1 AND m.role='EMPLOYEE'
    `, [req.member.organisation_id]);

    let totalBase = 0, totalOT = 0, totalHours = 0, empCount = 0;
    for (const emp of employees.rows) {
      const shifts = await query(`
        SELECT EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp))/3600 as raw_hours
        FROM shifts s
        LEFT JOIN clock_events ci ON s.id=ci.shift_id AND ci.type='CLOCK_IN'
        LEFT JOIN clock_events co ON s.id=co.shift_id AND co.type='CLOCK_OUT'
        WHERE s.assignee_id=$1 AND s.status='COMPLETED'
          AND ci.timestamp >= $2::date AND ci.timestamp <= ($3::date + INTERVAL '1 day')
      `, [emp.id, period.rows[0].start_date, period.rows[0].end_date]);

      let empTotalH = 0;
      shifts.rows.forEach(s => { empTotalH += Math.max(0, parseFloat(s.raw_hours) || 0); });

      const rate = parseFloat(emp.override_rate) || parseFloat(emp.hourly_rate) || 0;
      const otMult = parseFloat(emp.ot_mult);
      const otH = Math.max(0, empTotalH - 40);
      totalBase += (empTotalH - otH) * rate;
      totalOT += otH * rate * otMult;
      totalHours += empTotalH;
      if (empTotalH > 0) empCount++;
    }

    res.json({
      employeeCount: empCount,
      totalHours: Math.round(totalHours * 100) / 100,
      totalBaseEarnings: Math.round(totalBase * 100) / 100,
      totalOvertimeEarnings: Math.round(totalOT * 100) / 100,
      totalCost: Math.round((totalBase + totalOT) * 100) / 100,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

// Process pay period: lock and generate payslips
router.post("/pay-periods/:id/process", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const period = await query("SELECT * FROM pay_periods WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!period.rows.length) return res.status(404).json({ error: "Pay period not found" });
    if (period.rows[0].status !== "DRAFT") return res.status(400).json({ error: "Period already processed" });

    const org = await query("SELECT currency FROM organisations WHERE id=$1", [req.member.organisation_id]);
    const currency = org.rows[0]?.currency || "USD";

    const rules = await query("SELECT * FROM overtime_rules WHERE organisation_id=$1 AND is_active=true LIMIT 1", [req.member.organisation_id]);
    const rule = rules.rows[0] || { daily_threshold_hours: 8, weekly_threshold_hours: 40, daily_multiplier: 1.5 };

    const employees = await query(`
      SELECT m.id, m.name, er.hourly_rate as override_rate, er.overtime_multiplier as override_ot_mult, m.hourly_rate
      FROM members m
      LEFT JOIN LATERAL (SELECT * FROM employee_rates WHERE member_id=m.id ORDER BY effective_from DESC LIMIT 1) er ON true
      WHERE m.organisation_id=$1 AND m.role='EMPLOYEE'
    `, [req.member.organisation_id]);

    const generated = [];
    for (const emp of employees.rows) {
      const shifts = await query(`
        SELECT EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp))/3600 as raw_hours
        FROM shifts s
        LEFT JOIN clock_events ci ON s.id=ci.shift_id AND ci.type='CLOCK_IN'
        LEFT JOIN clock_events co ON s.id=co.shift_id AND co.type='CLOCK_OUT'
        WHERE s.assignee_id=$1 AND s.status='COMPLETED'
          AND ci.timestamp >= $2::date AND ci.timestamp <= ($3::date + INTERVAL '1 day')
      `, [emp.id, period.rows[0].start_date, period.rows[0].end_date]);

      let totalHours = 0;
      shifts.rows.forEach(s => { totalHours += Math.max(0, parseFloat(s.raw_hours) || 0); });

      const hourlyRate = parseFloat(emp.override_rate) || parseFloat(emp.hourly_rate) || 0;
      const otMult = parseFloat(emp.override_ot_mult) || parseFloat(rule.daily_multiplier);
      const otHours = Math.max(0, totalHours - 40);
      const baseHours = totalHours - otHours;
      const baseEarn = baseHours * hourlyRate;
      const otEarn = otHours * hourlyRate * otMult;

      if (hourlyRate > 0) {
        const result = await query(
          `INSERT INTO payslips (member_id, pay_period_id, organisation_id, base_hours, overtime_hours, overtime_rate, base_earnings, overtime_earnings, total_earnings, currency, generated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [emp.id, req.params.id, req.member.organisation_id,
           Math.round(baseHours * 100) / 100, Math.round(otHours * 100) / 100, otMult,
           Math.round(baseEarn * 100) / 100, Math.round(otEarn * 100) / 100,
           Math.round((baseEarn + otEarn) * 100) / 100, currency, req.member.id]
        );
        generated.push(result.rows[0]);
      }
    }

    await query("UPDATE pay_periods SET status='PROCESSED', processed_at=NOW() WHERE id=$1", [req.params.id]);
    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "UPDATE", entityType: "pay_period", entityId: req.params.id, newValues: { status: "PROCESSED" }, req });

    res.json({ success: true, payslipsGenerated: generated.length });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to process period" }); }
});

// Mark period as paid
router.post("/pay-periods/:id/paid", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await query("UPDATE pay_periods SET status='PAID' WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    res.json({ success: true });
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