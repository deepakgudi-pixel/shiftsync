const { query, pool } = require("../db/client");
const { logAudit } = require("../lib/audit");
const { emitEvent } = require("../lib/eventEmitter");
const { EVENT_TYPES } = require("../lib/events");
const {
  DEFAULT_OVERTIME_RULE,
  calculatePayrollTotals,
  normalizeOvertimeRule,
} = require("../lib/payrollCalculations");

const fetchAllShiftsForPeriod = async (orgId, startDate, endDate, client) => {
  const runner = client || { query: (text, params) => query(text, params) };
  const result = await runner.query(
    `SELECT
       s.assignee_id,
       DATE(ci.timestamp AT TIME ZONE 'UTC') as shift_date,
       EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp))/3600 as raw_hours
     FROM shifts s
     JOIN clock_events ci ON s.id = ci.shift_id AND ci.type = 'CLOCK_IN'
     JOIN clock_events co ON s.id = co.shift_id AND co.type = 'CLOCK_OUT'
     WHERE s.organisation_id = $1
       AND s.status = 'COMPLETED'
       AND ci.timestamp >= $2::date
       AND ci.timestamp <= ($3::date + INTERVAL '1 day')`,
    [orgId, startDate, endDate]
  );
  return result.rows;
};

const findPayPeriods = async (orgId) => {
  const result = await query(
    `SELECT pp.*, COUNT(p.id) as payslip_count,
       COALESCE((SELECT SUM(total_earnings) FROM payslips WHERE pay_period_id=pp.id), 0) as total_cost
     FROM pay_periods pp
     LEFT JOIN payslips p ON pp.id=p.pay_period_id
     WHERE pp.organisation_id=$1
     GROUP BY pp.id ORDER BY pp.start_date DESC`,
    [orgId]
  );
  return result.rows;
};

const createPayPeriod = async (orgId, periodType, startDate, endDate) => {
  const result = await query(
    "INSERT INTO pay_periods (organisation_id, period_type, start_date, end_date) VALUES ($1,$2,$3,$4) RETURNING *",
    [orgId, periodType, startDate, endDate]
  );
  return result.rows[0];
};

const findPayPeriodById = async (id, orgId, client) => {
  const runner = client || { query: (text, params) => query(text, params) };
  const result = await runner.query(
    "SELECT * FROM pay_periods WHERE id=$1 AND organisation_id=$2",
    [id, orgId]
  );
  return result.rows[0] || null;
};

const findActiveOvertimeRule = async (orgId, client) => {
  const runner = client || { query: (text, params) => query(text, params) };
  const result = await runner.query(
    "SELECT * FROM overtime_rules WHERE organisation_id=$1 AND is_active=true LIMIT 1",
    [orgId]
  );
  return result.rows[0] || null;
};

const findEmployeesWithRates = async (orgId, endDate, client) => {
  const runner = client || { query: (text, params) => query(text, params) };
  const result = await runner.query(
    `SELECT m.id, m.name, m.avatar_url, m.hourly_rate,
       er.id as override_rate_id,
       er.hourly_rate as override_rate,
       COALESCE(er.overtime_multiplier, $2) as ot_multiplier
     FROM members m
     LEFT JOIN LATERAL (SELECT * FROM employee_rates WHERE member_id=m.id AND effective_from <= $3 ORDER BY effective_from DESC LIMIT 1) er ON true
     WHERE m.organisation_id=$1 AND m.role='EMPLOYEE'`,
    [orgId, 1.5, endDate]
  );
  return result.rows;
};

const findExistingSnapshots = async (payPeriodId, client) => {
  const runner = client || { query: (text, params) => query(text, params) };
  const countResult = await runner.query(
    "SELECT COUNT(*) FROM payroll_snapshots WHERE pay_period_id=$1",
    [payPeriodId]
  );
  return parseInt(countResult.rows[0].count, 10);
};

const findSnapshotsWithMembers = async (payPeriodId) => {
  const result = await query(
    `SELECT ps.*, m.name, m.avatar_url
     FROM payroll_snapshots ps
     JOIN members m ON ps.member_id = m.id
     WHERE ps.pay_period_id = $1
     ORDER BY m.name`,
    [payPeriodId]
  );
  return result.rows;
};

const findPayslipsByPeriod = async (payPeriodId) => {
  const result = await query(
    "SELECT * FROM payslips WHERE pay_period_id=$1",
    [payPeriodId]
  );
  return result.rows;
};

const findOrganisationCurrency = async (orgId, client) => {
  const runner = client || { query: (text, params) => query(text, params) };
  const result = await runner.query(
    "SELECT currency FROM organisations WHERE id=$1",
    [orgId]
  );
  return result.rows[0]?.currency || "USD";
};

const insertPayrollSnapshot = async (client, data) => {
  await client.query(
    `INSERT INTO payroll_snapshots (
       pay_period_id, organisation_id, member_id,
       hourly_rate, effective_rate_id, overtime_multiplier,
       rule_id, rule_daily_threshold_hours, rule_weekly_threshold_hours,
       rule_daily_multiplier, rule_weekly_multiplier,
       total_hours, base_hours, overtime_hours,
       base_earnings, overtime_earnings, total_earnings,
       generated_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      data.payPeriodId, data.organisationId, data.memberId,
      data.hourlyRate, data.effectiveRateId, data.overtimeMultiplier,
      data.ruleId, data.ruleDailyThresholdHours, data.ruleWeeklyThresholdHours,
      data.ruleDailyMultiplier, data.ruleWeeklyMultiplier,
      data.totalHours, data.baseHours, data.overtimeHours,
      data.baseEarnings, data.overtimeEarnings, data.totalEarnings,
      data.generatedBy,
    ]
  );
};

const insertPayslip = async (client, data) => {
  const result = await client.query(
    `INSERT INTO payslips (member_id, pay_period_id, organisation_id, base_hours, overtime_hours, overtime_rate, base_earnings, overtime_earnings, total_earnings, currency, generated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      data.memberId, data.payPeriodId, data.organisationId,
      data.baseHours, data.overtimeHours, data.overtimeRate,
      data.baseEarnings, data.overtimeEarnings, data.totalEarnings,
      data.currency, data.generatedBy,
    ]
  );
  return result.rows[0];
};

const updatePayPeriodStatus = async (id, status, client) => {
  const runner = client || { query: (text, params) => query(text, params) };
  await runner.query(
    "UPDATE pay_periods SET status=$1, processed_at=NOW() WHERE id=$2",
    [status, id]
  );
};

const updatePayPeriodPaid = async (id, orgId) => {
  await query(
    "UPDATE pay_periods SET status='PAID' WHERE id=$1 AND organisation_id=$2",
    [id, orgId]
  );
};

const deletePayslipsAndSnapshots = async (payPeriodId, orgId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM payroll_snapshots WHERE pay_period_id=$1 AND organisation_id=$2",
      [payPeriodId, orgId]
    );
    const result = await client.query(
      "DELETE FROM payslips WHERE pay_period_id=$1 AND organisation_id=$2 RETURNING id",
      [payPeriodId, orgId]
    );
    await client.query(
      "UPDATE pay_periods SET status='DRAFT', processed_at=NULL WHERE id=$1 AND organisation_id=$2",
      [payPeriodId, orgId]
    );
    await client.query("COMMIT");
    return result.rowCount;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const findEmployeeInOrg = async (memberId, orgId) => {
  const result = await query(
    "SELECT id FROM members WHERE id=$1 AND organisation_id=$2",
    [memberId, orgId]
  );
  return result.rows[0] || null;
};

const findEmployeeRate = async (memberId) => {
  const result = await query(
    "SELECT * FROM employee_rates WHERE member_id=$1 ORDER BY effective_from DESC LIMIT 1",
    [memberId]
  );
  return result.rows[0] || null;
};

/**
 * Returns all EMPLOYEE members for an org with their most-recent effective rate
 * (a single query — replaces the N+1 pattern in loadEmployeeRates).
 */
const findAllEmployeeRatesForOrg = async (orgId) => {
  const result = await query(
    `SELECT
       m.id, m.name, m.email, m.avatar_url, m.hourly_rate, m.role,
       m.organisation_id, m.clerk_user_id,
       er.id            AS er_id,
       er.hourly_rate   AS custom_rate,
       er.overtime_multiplier AS custom_ot_mult,
       er.effective_from
     FROM members m
     LEFT JOIN LATERAL (
       SELECT * FROM employee_rates
       WHERE member_id = m.id
       ORDER BY effective_from DESC
       LIMIT 1
     ) er ON true
     WHERE m.organisation_id = $1
     ORDER BY m.name`,
    [orgId]
  );
  return result.rows;
};

const createEmployeeRate = async (memberId, hourlyRate, overtimeMultiplier, effectiveFrom) => {
  const result = await query(
    "INSERT INTO employee_rates (member_id, hourly_rate, overtime_multiplier, effective_from) VALUES ($1,$2,$3,$4) RETURNING *",
    [memberId, hourlyRate, overtimeMultiplier, effectiveFrom]
  );
  return result.rows[0];
};

const groupShiftsByEmployee = (shiftRows) => {
  const grouped = {};
  for (const row of shiftRows) {
    if (!row.assignee_id) continue;
    if (!grouped[row.assignee_id]) grouped[row.assignee_id] = [];
    grouped[row.assignee_id].push(row);
  }
  return grouped;
};

const buildDailyHoursMap = (shifts) => {
  const byDay = {};
  for (const s of shifts) {
    const h = Math.max(0, parseFloat(s.raw_hours) || 0);
    const day = s.shift_date;
    byDay[day] = (byDay[day] || 0) + h;
  }
  return byDay;
};

const getTimesheetData = async (payPeriodId, orgId) => {
  const period = await findPayPeriodById(payPeriodId, orgId);
  if (!period) return null;

  const rawRule = await findActiveOvertimeRule(orgId);
  const rule = normalizeOvertimeRule(rawRule || DEFAULT_OVERTIME_RULE);

  const employees = await findEmployeesWithRates(orgId, period.end_date);
  const shiftRows = await fetchAllShiftsForPeriod(orgId, period.start_date, period.end_date);
  const shiftsByEmp = groupShiftsByEmployee(shiftRows);

  const employeeData = employees.map((emp) => {
    const empShifts = shiftsByEmp[emp.id] || [];
    const dailyHours = Object.values(buildDailyHoursMap(empShifts));
    const hourlyRate = parseFloat(emp.override_rate) || parseFloat(emp.hourly_rate) || 0;
    const otMultiplier = parseFloat(String(emp.ot_multiplier)) || parseFloat(String(rule.daily_multiplier));

    const payroll = calculatePayrollTotals({
      dailyHours,
      hourlyRate,
      overtimeMultiplier: otMultiplier,
      rule,
    });

    return {
      employeeId: emp.id,
      name: emp.name,
      avatarUrl: emp.avatar_url,
      hourlyRate: payroll.hourlyRate,
      shifts: empShifts.map((s) => ({
        date: s.shift_date,
        hours: Math.round((parseFloat(s.raw_hours) || 0) * 100) / 100,
      })),
      totalHours: payroll.totalHours,
      baseHours: payroll.baseHours,
      overtimeHours: payroll.overtimeHours,
      baseEarnings: payroll.baseEarnings,
      overtimeEarnings: payroll.overtimeEarnings,
      totalEarnings: payroll.totalEarnings,
    };
  });

  return { period, rule, employees: employeeData };
};

const getSummaryData = async (payPeriodId, orgId) => {
  const period = await findPayPeriodById(payPeriodId, orgId);
  if (!period) return null;

  const rawRule = await findActiveOvertimeRule(orgId);
  const rule = normalizeOvertimeRule(rawRule || DEFAULT_OVERTIME_RULE);

  const employees = await findEmployeesWithRates(orgId, period.end_date);
  const shiftRows = await fetchAllShiftsForPeriod(orgId, period.start_date, period.end_date);

  const byEmp = {};
  for (const row of shiftRows) {
    if (!row.assignee_id) continue;
    if (!byEmp[row.assignee_id]) byEmp[row.assignee_id] = {};
    const day = row.shift_date;
    byEmp[row.assignee_id][day] =
      (byEmp[row.assignee_id][day] || 0) + Math.max(0, parseFloat(row.raw_hours) || 0);
  }

  let totalBase = 0;
  let totalOT = 0;
  let totalHours = 0;
  let empCount = 0;
  const breakdown = [];

  for (const emp of employees) {
    const dailyMap = byEmp[emp.id] || {};
    const dailyHours = Object.values(dailyMap);
    if (dailyHours.length === 0) continue;

    const payroll = calculatePayrollTotals({
      dailyHours,
      hourlyRate: parseFloat(emp.override_rate) || parseFloat(emp.hourly_rate) || 0,
      overtimeMultiplier: parseFloat(String(emp.ot_multiplier)) || parseFloat(String(rule.daily_multiplier)),
      rule,
    });

    totalBase += payroll.baseEarnings;
    totalOT += payroll.overtimeEarnings;
    totalHours += payroll.totalHours;
    empCount++;
    breakdown.push({
      empId: emp.id,
      name: emp.name,
      rate: payroll.hourlyRate,
      totalHours: payroll.totalHours,
      overtimeHours: payroll.overtimeHours,
      baseEarn: payroll.baseEarnings,
      otEarn: payroll.overtimeEarnings,
    });
  }

  return {
    employeeCount: empCount,
    totalHours: Math.round(totalHours * 100) / 100,
    totalBaseEarnings: Math.round(totalBase * 100) / 100,
    totalOvertimeEarnings: Math.round(totalOT * 100) / 100,
    totalCost: Math.round((totalBase + totalOT) * 100) / 100,
    rule,
    breakdown,
  };
};

const processPayPeriod = async (payPeriodId, orgId, memberId, clerkUserId, req) => {
  const client = await pool.connect();
  try {
    const period = await findPayPeriodById(payPeriodId, orgId, client);
    if (!period) return { status: 404, body: { error: "Pay period not found" } };
    if (period.status !== "DRAFT") return { status: 400, body: { error: "Period already processed" } };

    const existingCount = await findExistingSnapshots(payPeriodId, client);
    if (existingCount > 0) {
      const snapshots = await findSnapshotsWithMembers(payPeriodId);
      const payslips = await findPayslipsByPeriod(payPeriodId);
      return {
        status: 200,
        body: {
          cached: true,
          message: "Pay period was already processed",
          snapshots,
          payslips,
        },
      };
    }

    const currency = await findOrganisationCurrency(orgId, client);
    const rawRule = await findActiveOvertimeRule(orgId, client);
    const rule = {
      id: rawRule?.id || null,
      ...normalizeOvertimeRule(rawRule || DEFAULT_OVERTIME_RULE),
    };

    const employees = await findEmployeesWithRates(orgId, period.end_date, client);
    const shiftRows = await fetchAllShiftsForPeriod(orgId, period.start_date, period.end_date, client);
    const shiftsByEmp = groupShiftsByEmployee(shiftRows);

    const generated = [];
    const skipped = [];

    for (const emp of employees) {
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

      const dailyHours = Object.values(buildDailyHoursMap(empShifts));
      const otMultiplier = parseFloat(String(emp.ot_multiplier)) || parseFloat(String(rule.daily_multiplier));

      const payroll = calculatePayrollTotals({
        dailyHours,
        hourlyRate,
        overtimeMultiplier: otMultiplier,
        rule,
      });

      await insertPayrollSnapshot(client, {
        payPeriodId,
        organisationId: orgId,
        memberId: emp.id,
        hourlyRate,
        effectiveRateId: emp.override_rate_id || null,
        overtimeMultiplier: payroll.overtimeMultiplier,
        ruleId: rule.id || null,
        ruleDailyThresholdHours: rule.daily_threshold_hours,
        ruleWeeklyThresholdHours: rule.weekly_threshold_hours,
        ruleDailyMultiplier: rule.daily_multiplier,
        ruleWeeklyMultiplier: rule.weekly_multiplier,
        totalHours: payroll.totalHours,
        baseHours: payroll.baseHours,
        overtimeHours: payroll.overtimeHours,
        baseEarnings: payroll.baseEarnings,
        overtimeEarnings: payroll.overtimeEarnings,
        totalEarnings: payroll.totalEarnings,
        generatedBy: memberId,
      });

      const payslip = await insertPayslip(client, {
        memberId: emp.id,
        payPeriodId,
        organisationId: orgId,
        baseHours: payroll.baseHours,
        overtimeHours: payroll.overtimeHours,
        overtimeRate: payroll.overtimeMultiplier,
        baseEarnings: payroll.baseEarnings,
        overtimeEarnings: payroll.overtimeEarnings,
        totalEarnings: payroll.totalEarnings,
        currency,
        generatedBy: memberId,
      });
      generated.push({ id: payslip.id, name: emp.name, totalEarn: payroll.totalEarnings });
    }

    await updatePayPeriodStatus(payPeriodId, "PROCESSED", client);

    await emitEvent({
      client,
      organisationId: orgId,
      memberId,
      eventType: EVENT_TYPES.PAY_PERIOD_PROCESSED,
      entityType: "pay_period",
      entityId: payPeriodId,
      payload: { generated: generated.length, skipped: skipped.length },
      req,
    });

    await logAudit({
      organisationId: orgId,
      memberId,
      clerkUserId,
      action: "UPDATE",
      entityType: "pay_period",
      entityId: payPeriodId,
      newValues: { status: "PROCESSED", payslipsGenerated: generated.length },
      req,
    });

    return {
      status: 200,
      body: {
        success: true,
        payslipsGenerated: generated.length,
        generated,
        skipped,
      },
    };
  } finally {
    client.release();
  }
};

module.exports = {
  getTimesheetData,
  getSummaryData,
  processPayPeriod,
  findPayPeriods,
  createPayPeriod,
  updatePayPeriodPaid,
  deletePayslipsAndSnapshots,
  findEmployeeInOrg,
  findEmployeeRate,
  findAllEmployeeRatesForOrg,
  createEmployeeRate,
};
