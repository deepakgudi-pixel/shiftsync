// @ts-nocheck
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { pool, query } = require("../db/client");
const crypto = require("crypto");

const genId = () => crypto.randomUUID();

const getDemoMembers = async () => {
  const result = await query(
    "SELECT m.*, o.name as organisation_name FROM members m JOIN organisations o ON o.id = m.organisation_id WHERE m.email LIKE '%northstar%'"
  );
  const byRole = {};
  for (const row of result.rows) byRole[row.role.toLowerCase()] = row;
  const employees = result.rows.filter(r => r.role === "EMPLOYEE");
  if (!byRole.admin || !byRole.manager || employees.length < 1) throw new Error("Missing demo accounts. Run db:seed first.");
  return { admin: byRole.admin, manager: byRole.manager, employees, all: result.rows };
};

const clearExistingScenario = async (orgId) => {
  await query("DELETE FROM notifications WHERE member_id IN (SELECT id FROM members WHERE organisation_id = $1)", [orgId]);
  await query("DELETE FROM messages WHERE sender_id IN (SELECT id FROM members WHERE organisation_id = $1)", [orgId]);
  await query("DELETE FROM announcements WHERE organisation_id = $1", [orgId]);
  await query("DELETE FROM payslips WHERE organisation_id = $1", [orgId]);
  await query("DELETE FROM payroll_snapshots WHERE organisation_id = $1", [orgId]);
  await query("DELETE FROM pay_periods WHERE organisation_id = $1", [orgId]);
  await query("DELETE FROM overtime_rules WHERE organisation_id = $1", [orgId]);
  await query("DELETE FROM employee_rates WHERE member_id IN (SELECT id FROM members WHERE organisation_id = $1)", [orgId]);
  await query("DELETE FROM availability WHERE member_id IN (SELECT id FROM members WHERE organisation_id = $1)", [orgId]);
  await query("DELETE FROM swap_requests WHERE shift_id IN (SELECT id FROM shifts WHERE organisation_id = $1)", [orgId]);
  await query("DELETE FROM clock_events WHERE shift_id IN (SELECT id FROM shifts WHERE organisation_id = $1)", [orgId]);
  await query("DELETE FROM shifts WHERE organisation_id = $1", [orgId]);
};

const addDays = (base, days) => { const v = new Date(base); v.setDate(v.getDate() + days); return v; };
const atTime = (base, h, m = 0) => { const v = new Date(base); v.setHours(h, m, 0, 0); return v; };
const iso = (d) => d.toISOString();
const isoDate = (d) => d.toISOString().slice(0, 10);
const hoursBetween = (start, end) => (end - start) / (1000 * 60 * 60);
const roundMoney = (value) => Math.round(value * 100) / 100;
const roundHours = (value) => Math.round(value * 100) / 100;

const insertShift = async (orgId, id, title, start, end, loc, notes, color, status, assigneeId) => {
  await query(
    `INSERT INTO shifts (id, title, start_time, end_time, location, notes, color, status, organisation_id, assignee_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
    [id, title, iso(start), iso(end), loc, notes, color, status, orgId, assigneeId]
  );
};

const insertClock = async (shiftId, memberId, type, timestamp) => {
  await query(
    "INSERT INTO clock_events (id, shift_id, member_id, type, timestamp) VALUES ($1,$2,$3,$4,$5)",
    [genId(), shiftId, memberId, type, iso(timestamp)]
  );
};

const completeShift = async (orgId, title, start, end, loc, notes, color, emp) => {
  const id = genId();
  await insertShift(orgId, id, title, start, end, loc, notes, color, "COMPLETED", emp.id);
  await insertClock(id, emp.id, "CLOCK_IN", start);
  await insertClock(id, emp.id, "CLOCK_OUT", end);
  return { id, emp, start, end };
};

const seedDemoScenario = async () => {
  try {
    const { admin, manager, employees } = await getDemoMembers();
    const orgId = admin.organisation_id;
    const employeeByEmail = new Map(employees.map((employee) => [employee.email, employee]));
    const leah = employeeByEmail.get("demo.leah.northstar+clerk_test@example.com") || employees[0];
    const nina = employeeByEmail.get("demo.nina.northstar+clerk_test@example.com") || employees[1] || employees[0];
    const owen = employeeByEmail.get("demo.owen.northstar+clerk_test@example.com") || employees[2] || employees[0];
    const rates = new Map([
      [leah.id, 28],
      [nina.id, 24],
      [owen.id, 30],
    ]);

    console.log(`Seeding: ${admin.organisation_name} | ${employees.length} employees`);
    await clearExistingScenario(orgId);

    const today = new Date();
    const currentWeekStart = (() => { const d = new Date(today); const diff = d.getDay() === 0 ? -6 : 1 - d.getDay(); d.setDate(d.getDate() + diff); d.setHours(0,0,0,0); return d; })();
    const thirtyDaysAgo = addDays(today, -30);

    await query("UPDATE organisations SET currency = $1, updated_at = NOW() WHERE id = $2", ["USD", orgId]);

    // Availability
    for (const emp of employees) {
      for (let day = 1; day <= 5; day++) await query("INSERT INTO availability (member_id, day_of_week, start_time, end_time) VALUES ($1,$2,'06:00','22:00')", [emp.id, day]);
      await query("INSERT INTO availability (member_id, day_of_week, start_time, end_time) VALUES ($1,6,'08:00','16:00')", [emp.id]);
    }

    // overtime rule
    await query("INSERT INTO overtime_rules (organisation_id, name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active) VALUES ($1,'Standard OT',8,40,1.5,1.5,true)", [orgId]);

    // employee rates
    for (const emp of employees) {
      await query(
        "INSERT INTO employee_rates (member_id, hourly_rate, overtime_multiplier, effective_from) VALUES ($1,$2,1.5,$3)",
        [emp.id, rates.get(emp.id) || Number(emp.hourly_rate) || 24, isoDate(thirtyDaysAgo)]
      );
    }

    // Historical logistics surge data. These real shifts drive the dashboard
    // analytics graph, labor hours, and payroll snapshots.
    const completedShifts = [];
    const weeklyTemplates = [
      { day: 0, title: "Inbound Receiving Wave", start: 6, end: 14, loc: "Dock 3", notes: "Container unload and pallet scan.", color: "#2563eb", emp: leah },
      { day: 0, title: "Cross-Dock Sort", start: 7, end: 16, loc: "Sort Aisle", notes: "Storm backlog priority sort.", color: "#0891b2", emp: owen },
      { day: 0, title: "E-Commerce Pick Pack", start: 14, end: 22, loc: "Fulfillment Bay", notes: "Late wave pick list.", color: "#7c3aed", emp: nina },
      { day: 1, title: "Outbound Trailer Load", start: 6, end: 15, loc: "Dock 8", notes: "Regional trailer staging.", color: "#16a34a", emp: owen },
      { day: 1, title: "Returns Triage", start: 8, end: 16, loc: "Returns Cage", notes: "Scan and restock returns.", color: "#d97706", emp: nina },
      { day: 1, title: "Inventory Cycle Count", start: 14, end: 22, loc: "Zone C", notes: "Cycle count high-value SKUs.", color: "#4f46e5", emp: leah },
      { day: 2, title: "Priority Dispatch Desk", start: 6, end: 14, loc: "Dispatch Office", notes: "Carrier exception handling.", color: "#be185d", emp: owen },
      { day: 2, title: "Cold Chain Audit", start: 8, end: 16, loc: "Cold Storage", notes: "Temperature log reconciliation.", color: "#0e7490", emp: leah },
      { day: 2, title: "Parcel Induction", start: 14, end: 22, loc: "Induction Line", notes: "Parcel intake surge lane.", color: "#9333ea", emp: nina },
      { day: 3, title: "Warehouse Safety Sweep", start: 6, end: 14, loc: "All Zones", notes: "Pre-shift safety audit.", color: "#ca8a04", emp: leah },
      { day: 3, title: "Forklift Replenishment", start: 7, end: 16, loc: "Reserve Racks", notes: "Replenish forward pick faces.", color: "#059669", emp: owen },
      { day: 3, title: "Late Order Recovery", start: 14, end: 23, loc: "Packing Line 2", notes: "Recover late marketplace orders.", color: "#dc2626", emp: nina },
      { day: 4, title: "Carrier Handoff", start: 6, end: 14, loc: "Yard Gate", notes: "Carrier check-in and seal audit.", color: "#2563eb", emp: owen },
      { day: 4, title: "Stock Accuracy Sprint", start: 8, end: 16, loc: "Zone B", notes: "Resolve negative inventory.", color: "#7c3aed", emp: leah },
      { day: 4, title: "Weekend Prep Packout", start: 14, end: 22, loc: "Fulfillment Bay", notes: "Prep weekend order queue.", color: "#ea580c", emp: nina },
    ];

    for (let weekOffset = 4; weekOffset >= 1; weekOffset--) {
      const weekStart = addDays(currentWeekStart, -weekOffset * 7);
      const surgeMultiplier = weekOffset === 1 ? 1 : weekOffset === 2 ? 0.85 : 0.7;

      for (const template of weeklyTemplates) {
        const day = addDays(weekStart, template.day);
        completedShifts.push(await completeShift(
          orgId,
          template.title,
          atTime(day, template.start),
          atTime(day, template.end),
          template.loc,
          template.notes,
          template.color,
          template.emp
        ));
      }

      if (surgeMultiplier >= 0.85) {
        const saturday = addDays(weekStart, 5);
        completedShifts.push(await completeShift(orgId, "Saturday Backlog Burn-Down", atTime(saturday, 8), atTime(saturday, 16), "Dock 5", "Clear delayed Northeast freight.", "#dc2626", leah));
        completedShifts.push(await completeShift(orgId, "Weekend Parcel Sort", atTime(saturday, 9), atTime(saturday, 17), "Sort Aisle", "Weekend parcel surge.", "#9333ea", nina));
      }

      if (surgeMultiplier === 1) {
        const sunday = addDays(weekStart, 6);
        completedShifts.push(await completeShift(orgId, "Sunday Yard Recovery", atTime(sunday, 8), atTime(sunday, 14), "Yard Gate", "Recover delayed trailers.", "#059669", owen));
      }
    }

    console.log(`Created ${completedShifts.length} completed historical shifts`);

    // This week: completed work, live operations, upcoming work, and open coverage.
    await completeShift(orgId, "Monday Inbound Surge", atTime(currentWeekStart, 6), atTime(currentWeekStart, 14), "Dock 3", "Storm recovery inbound wave.", "#2563eb", leah);
    await completeShift(orgId, "Monday Trailer Staging", atTime(currentWeekStart, 7), atTime(currentWeekStart, 16), "Yard Gate", "Stage delayed outbound trailers.", "#059669", owen);
    await completeShift(orgId, "Monday Marketplace Packout", atTime(currentWeekStart, 14), atTime(currentWeekStart, 22), "Packing Line 2", "Marketplace order recovery.", "#9333ea", nina);

    await completeShift(orgId, "Tuesday Returns Triage", atTime(addDays(currentWeekStart, 1), 6), atTime(addDays(currentWeekStart, 1), 14), "Returns Cage", "High-volume returns intake.", "#d97706", leah);
    await completeShift(orgId, "Tuesday Priority Dispatch", atTime(addDays(currentWeekStart, 1), 7), atTime(addDays(currentWeekStart, 1), 16), "Dispatch Office", "Resolve carrier exceptions.", "#be185d", owen);
    await completeShift(orgId, "Tuesday Cold Chain Audit", atTime(addDays(currentWeekStart, 1), 14), atTime(addDays(currentWeekStart, 1), 22), "Cold Storage", "Audit temperature-sensitive freight.", "#0e7490", nina);

    const liveStartA = new Date(today.getTime() - 75 * 60 * 1000);
    const liveStartB = new Date(today.getTime() - 35 * 60 * 1000);
    const liveEnd = new Date(today.getTime() + 6 * 60 * 60 * 1000);
    const liveDispatchId = genId();
    const livePackoutId = genId();
    await insertShift(orgId, liveDispatchId, "Live Dispatch Recovery", liveStartA, liveEnd, "Dispatch Office", "Active recovery desk for delayed Northeast lanes.", "#be185d", "IN_PROGRESS", owen.id);
    await insertClock(liveDispatchId, owen.id, "CLOCK_IN", liveStartA);
    await insertShift(orgId, livePackoutId, "Live Packout Wave", liveStartB, liveEnd, "Packing Line 1", "Active e-commerce packout wave.", "#9333ea", "IN_PROGRESS", nina.id);
    await insertClock(livePackoutId, nina.id, "CLOCK_IN", liveStartB);

    await insertShift(orgId, genId(), "Wednesday Cycle Count", atTime(addDays(currentWeekStart, 2), 14), atTime(addDays(currentWeekStart, 2), 22), "Zone C", "Post-surge stock accuracy.", "#4f46e5", "ASSIGNED", leah.id);
    await insertShift(orgId, genId(), "Thursday Forklift Replenishment", atTime(addDays(currentWeekStart, 3), 7), atTime(addDays(currentWeekStart, 3), 16), "Reserve Racks", "Replenish pick faces.", "#059669", "ASSIGNED", owen.id);
    await insertShift(orgId, genId(), "Thursday Late Order Recovery", atTime(addDays(currentWeekStart, 3), 14), atTime(addDays(currentWeekStart, 3), 22), "Packing Line 2", "Recover late order queue.", "#dc2626", "ASSIGNED", nina.id);
    await insertShift(orgId, genId(), "Friday Carrier Handoff", atTime(addDays(currentWeekStart, 4), 6), atTime(addDays(currentWeekStart, 4), 14), "Yard Gate", "Seal audit and carrier release.", "#2563eb", "ASSIGNED", owen.id);
    await insertShift(orgId, genId(), "Friday Stock Accuracy Sprint", atTime(addDays(currentWeekStart, 4), 8), atTime(addDays(currentWeekStart, 4), 16), "Zone B", "Resolve negative inventory before weekend.", "#7c3aed", "ASSIGNED", leah.id);

    await insertShift(orgId, genId(), "Saturday Dock Coverage", atTime(addDays(currentWeekStart, 5), 8), atTime(addDays(currentWeekStart, 5), 16), "Dock 5", "Open coverage for delayed trailer unload.", "#dc2626", "OPEN", null);
    await insertShift(orgId, genId(), "Sunday Yard Check", atTime(addDays(currentWeekStart, 6), 8), atTime(addDays(currentWeekStart, 6), 14), "Yard Gate", "Open yard check after carrier surge.", "#059669", "OPEN", null);

    // Swap request
    const swapId = genId();
    await insertShift(orgId, swapId, "Saturday Parcel Sort Lead", atTime(addDays(currentWeekStart, 5), 9), atTime(addDays(currentWeekStart, 5), 17), "Sort Aisle", "Swap requested for weekend surge.", "#9333ea", "ASSIGNED", leah.id);
    await query("INSERT INTO swap_requests (id, shift_id, requester_id, target_id, reason, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,'PENDING',NOW(),NOW())", [genId(), swapId, leah.id, nina.id, "Need coverage for a family commitment during the weekend surge."]);

    console.log("Created this week's shifts");

    // Announcements
    await query("INSERT INTO announcements (id, title, content, priority, organisation_id, author_id, created_at) VALUES ($1,$2,$3,'URGENT',$4,$5,NOW())", [genId(), "Storm Recovery Plan Active", "All outbound Northeast lanes are running surge coverage through Sunday.", orgId, admin.id]);
    await query("INSERT INTO announcements (id, title, content, priority, organisation_id, author_id, created_at) VALUES ($1,$2,$3,'HIGH',$4,$5,NOW())", [genId(), "Dock 5 Needs Weekend Coverage", "Two open shifts are available for delayed trailer unload and yard checks.", orgId, manager.id]);
    await query("INSERT INTO announcements (id, title, content, priority, organisation_id, author_id, created_at) VALUES ($1,$2,$3,'NORMAL',$4,$5,NOW())", [genId(), "Inventory Accuracy Sprint", "Zone B and Zone C counts are scheduled before Friday carrier handoff.", orgId, manager.id]);

    // Messages
    await query("INSERT INTO messages (id, sender_id, receiver_id, content, read, created_at) VALUES ($1,$2,$3,$4,true,NOW())", [genId(), manager.id, admin.id, "Storm recovery schedule is loaded. Two open shifts remain for Dock 5 and yard checks."]);
    await query("INSERT INTO messages (id, sender_id, receiver_id, content, read, created_at) VALUES ($1,$2,$3,$4,true,NOW())", [genId(), admin.id, manager.id, "Looks sharp. Prioritize open weekend coverage and keep payroll snapshots ready for review."]);
    await query("INSERT INTO messages (id, sender_id, receiver_id, content, read, created_at) VALUES ($1,$2,$3,$4,false,NOW())", [genId(), leah.id, nina.id, "Can you cover my Saturday parcel sort lead shift? I can trade for a Zone C count next week."]);
    await query("INSERT INTO messages (id, sender_id, receiver_id, content, read, created_at) VALUES ($1,$2,$3,$4,false,NOW())", [genId(), owen.id, manager.id, "Live dispatch recovery is on track. Carrier exceptions should be cleared before the late packout wave."]);

    // Pay periods and frozen payroll snapshots.
    const periodStart = addDays(currentWeekStart, -14);
    const periodEnd = addDays(currentWeekStart, -1);
    const periodId = genId();
    await query("INSERT INTO pay_periods (id, organisation_id, period_type, start_date, end_date, status, processed_at, created_at) VALUES ($1,$2,'BIWEEKLY',$3,$4,'PROCESSED',NOW(),NOW())", [periodId, orgId, isoDate(periodStart), isoDate(periodEnd)]);

    for (const emp of employees) {
      const empShifts = completedShifts.filter(s => s.emp.id === emp.id && s.start >= periodStart && s.start <= periodEnd);
      if (empShifts.length === 0) continue;
      const totalHours = empShifts.reduce((sum, shift) => sum + hoursBetween(shift.start, shift.end), 0);
      const baseHours = Math.min(totalHours, 80);
      const otHours = Math.max(0, totalHours - 80);
      const rate = rates.get(emp.id) || Number(emp.hourly_rate) || 24;
      const baseEarn = roundMoney(baseHours * rate);
      const otEarn = roundMoney(otHours * rate * 1.5);
      const totalEarn = roundMoney(baseEarn + otEarn);
      const rulesSnapshot = {
        scenario: "Northeast storm recovery surge",
        dailyThresholdHours: 8,
        weeklyThresholdHours: 40,
        dailyMultiplier: 1.5,
        weeklyMultiplier: 1.5,
        source: "demo-seed",
      };

      await query("INSERT INTO payroll_snapshots (id, pay_period_id, organisation_id, member_id, hourly_rate, overtime_multiplier, rule_daily_threshold_hours, rule_weekly_threshold_hours, rule_daily_multiplier, rule_weekly_multiplier, rules_snapshot, total_hours, base_hours, overtime_hours, base_earnings, overtime_earnings, total_earnings, generated_by, created_at) VALUES ($1,$2,$3,$4,$5,1.5,8,40,1.5,1.5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())",
        [genId(), periodId, orgId, emp.id, rate, JSON.stringify(rulesSnapshot), roundHours(totalHours), roundHours(baseHours), roundHours(otHours), baseEarn, otEarn, totalEarn, admin.id]);

      await query("INSERT INTO payslips (id, member_id, pay_period_id, organisation_id, base_hours, overtime_hours, overtime_rate, base_earnings, overtime_earnings, total_earnings, currency, status, generated_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,1.5,$7,$8,$9,'USD','DOWNLOADED',$10,NOW())",
        [genId(), emp.id, periodId, orgId, roundHours(baseHours), roundHours(otHours), baseEarn, otEarn, totalEarn, admin.id]);
    }

    await query("INSERT INTO pay_periods (id, organisation_id, period_type, start_date, end_date, status, created_at) VALUES ($1,$2,'WEEKLY',$3,$4,'DRAFT',NOW())", [genId(), orgId, isoDate(currentWeekStart), isoDate(addDays(currentWeekStart, 6))]);

    
    // summary
    
    const stats = await query(
      `SELECT (SELECT COUNT(*) FROM shifts WHERE organisation_id=$1) as total,
        (SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='COMPLETED') as completed,
        (SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='IN_PROGRESS') as in_progress,
        (SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='ASSIGNED') as assigned,
        (SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='OPEN') as open,
        (SELECT COUNT(*) FROM announcements WHERE organisation_id=$1) as announcements,
        (SELECT COUNT(*) FROM messages WHERE sender_id IN (SELECT id FROM members WHERE organisation_id=$1)) as messages,
        (SELECT COUNT(*) FROM pay_periods WHERE organisation_id=$1 AND status='PROCESSED') as processed,
        (SELECT COUNT(*) FROM pay_periods WHERE organisation_id=$1 AND status='DRAFT') as draft,
        (SELECT COUNT(*) FROM swap_requests sr JOIN shifts s ON sr.shift_id=s.id WHERE s.organisation_id=$1 AND sr.status='PENDING') as swaps,
        (SELECT json_agg(row_to_json(day_counts) ORDER BY day_counts.dow)
           FROM (
             SELECT EXTRACT(DOW FROM start_time)::int AS dow,
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE status='COMPLETED') AS completed
               FROM shifts
              WHERE organisation_id=$1 AND start_time >= $2
              GROUP BY dow
           ) day_counts) as graph`,
      [orgId, thirtyDaysAgo]
    );

    const payrollStats = await query(
      `SELECT COUNT(*) as snapshots,
              COALESCE(SUM(total_hours), 0) as hours,
              COALESCE(SUM(total_earnings), 0) as earnings
         FROM payroll_snapshots
        WHERE organisation_id=$1`,
      [orgId]
    );

    const s = stats.rows[0];
    console.log("\n=== Scenario Seeded ===");
    console.log(`Completed: ${s.completed} | In Progress: ${s.in_progress} | Assigned: ${s.assigned} | Open: ${s.open}`);
    console.log(`Analytics graph: ${JSON.stringify(s.graph || [])}`);
    console.log(`Announcements: ${s.announcements} | Messages: ${s.messages}`);
    console.log(`Pay Periods: ${s.processed} processed, ${s.draft} draft | Swaps: ${s.swaps} pending`);
    console.log(`Payroll Snapshots: ${payrollStats.rows[0].snapshots} | Hours: ${payrollStats.rows[0].hours} | Earnings: ${payrollStats.rows[0].earnings}`);
    console.log(`\nLogin: ${admin.name} (${admin.email})`);
    console.log("=========================");
    return s;
  } catch (error) {
    console.error("Failed to seed demo scenario");
    console.error(error);
    throw error;
  }
};

if (require.main === module) {
  seedDemoScenario()
    .catch(() => {
      process.exitCode = 1;
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { seedDemoScenario };

export {};
