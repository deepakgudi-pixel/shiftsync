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
    const [e1, e2] = employees;

    console.log(`Seeding: ${admin.organisation_name} | ${employees.length} employees`);
    await clearExistingScenario(orgId);

    const today = new Date();
    const currentWeekStart = (() => { const d = new Date(today); const diff = d.getDay() === 0 ? -6 : 1 - d.getDay(); d.setDate(d.getDate() + diff); d.setHours(0,0,0,0); return d; })();
    const thirtyDaysAgo = addDays(today, -30);

    await query("UPDATE organisations SET currency = $1, updated_at = NOW() WHERE id = $2", ["USD", orgId]);

    // Availability
    for (const emp of employees) {
      for (let day = 1; day <= 5; day++) await query("INSERT INTO availability (member_id, day_of_week, start_time, end_time) VALUES ($1,$2,'07:00','18:00')", [emp.id, day]);
    }

    // overtime rule
    await query("INSERT INTO overtime_rules (organisation_id, name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active) VALUES ($1,'Standard OT',8,40,1.5,1.5,true)", [orgId]);

    // employee rates
    for (const [emp, rate] of [[e1, 28], [e2, 26]]) {
      await query("INSERT INTO employee_rates (member_id, hourly_rate, overtime_multiplier, effective_from) VALUES ($1,$2,1.5,$3)", [emp.id, rate, isoDate(thirtyDaysAgo)]);
    }

    
    // historical shifts for analytics
    
    const completedShifts = [];
    const weeks = 3;

    for (let w = 0; w < weeks; w++) {
      const ws = addDays(currentWeekStart, -(w + 1) * 7);
      const daysInWeek = w === 0 ? 5 : 7; // most recent past week: Mon-Fri only

      // Mon
      completedShifts.push(await completeShift(orgId, "Morning Ward Cleaning", atTime(ws, 7), atTime(ws, 15), "Building A", "Standard rotation.", "#4f6eff", e1));
      completedShifts.push(await completeShift(orgId, "HVAC Maintenance", atTime(ws, 6), atTime(ws, 16), "Mechanical Room", "Filter replacement.", "#059669", e2));
      // Tue
      completedShifts.push(await completeShift(orgId, "Surgical Wing Sanitation", atTime(addDays(ws, 1), 7), atTime(addDays(ws, 1), 15), "Surgical Wing B", "Deep clean.", "#dc2626", e1));
      completedShifts.push(await completeShift(orgId, "Cafeteria Reset", atTime(addDays(ws, 1), 7), atTime(addDays(ws, 1), 16), "Staff Cafeteria", "Extended shift.", "#d97706", e2));
      // Wed
      completedShifts.push(await completeShift(orgId, "Boiler Room Inspection", atTime(addDays(ws, 2), 6), atTime(addDays(ws, 2), 14), "Basement Utility", "Routine check.", "#0891b2", e2));
      completedShifts.push(await completeShift(orgId, "ICU Terminal Clean", atTime(addDays(ws, 2), 7), atTime(addDays(ws, 2), 15), "ICU Wing", "Terminal cleaning.", "#be185d", e1));
      // Thu
      completedShifts.push(await completeShift(orgId, "Emergency Dept Deep Clean", atTime(addDays(ws, 3), 7), atTime(addDays(ws, 3), 15), "Emergency Dept", "Weekly clean.", "#dc2626", e1));
      completedShifts.push(await completeShift(orgId, "Parking Garage Maintenance", atTime(addDays(ws, 3), 6), atTime(addDays(ws, 3), 15), "Parking Structure", "Pressure wash.", "#059669", e2));
      // Fri
      completedShifts.push(await completeShift(orgId, "Weekly Ward Rotation", atTime(addDays(ws, 4), 7), atTime(addDays(ws, 4), 15), "Building B", "End of week.", "#4f6eff", e1));
      completedShifts.push(await completeShift(orgId, "Laundry Facility Audit", atTime(addDays(ws, 4), 7), atTime(addDays(ws, 4), 15), "Laundry Wing", "Equipment check.", "#7c3aed", e2));

      if (daysInWeek === 7) {
        completedShifts.push(await completeShift(orgId, "Weekend Ward Coverage", atTime(addDays(ws, 5), 8), atTime(addDays(ws, 5), 16), "Building A", "Saturday.", "#d97706", e1));
        completedShifts.push(await completeShift(orgId, "Weekend Maintenance", atTime(addDays(ws, 6), 8), atTime(addDays(ws, 6), 14), "Utility Building", "Sunday.", "#059669", e2));
      }
    }

    console.log(`Created ${completedShifts.length} completed historical shifts`);

    
    // this week
    
    // Mon & Tue completed
    await completeShift(orgId, "Morning Ward Cleaning", atTime(currentWeekStart, 7), atTime(currentWeekStart, 15), "Building A", "This week.", "#4f6eff", e1);
    await completeShift(orgId, "HVAC Maintenance", atTime(currentWeekStart, 6), atTime(currentWeekStart, 16), "Mechanical Room", "This week.", "#059669", e2);
    await completeShift(orgId, "Surgical Wing Sanitation", atTime(addDays(currentWeekStart, 1), 7), atTime(addDays(currentWeekStart, 1), 15), "Surgical Wing B", "This week.", "#dc2626", e1);
    await completeShift(orgId, "Cafeteria Reset", atTime(addDays(currentWeekStart, 1), 7), atTime(addDays(currentWeekStart, 1), 15), "Staff Cafeteria", "This week.", "#d97706", e2);

    // Wed — LIVE (e2 clocked in 1hr ago)
    const liveStart = new Date(today.getTime() - 60 * 60 * 1000);
    const liveEnd = atTime(today, 15);
    const liveId = genId();
    await insertShift(orgId, liveId, "ICU Terminal Clean", liveStart, liveEnd, "ICU Wing", "Currently active.", "#be185d", "IN_PROGRESS", e2.id);
    await insertClock(liveId, e2.id, "CLOCK_IN", liveStart);

    // Thu & Fri — ASSIGNED
    await insertShift(orgId, genId(), "Emergency Dept Deep Clean", atTime(addDays(currentWeekStart, 3), 7), atTime(addDays(currentWeekStart, 3), 15), "Emergency Dept", "Upcoming.", "#dc2626", "ASSIGNED", e1.id);
    await insertShift(orgId, genId(), "Weekly Ward Rotation", atTime(addDays(currentWeekStart, 4), 7), atTime(addDays(currentWeekStart, 4), 15), "Building B", "Upcoming.", "#4f6eff", "ASSIGNED", e2.id);

    // OPEN shift
    await insertShift(orgId, genId(), "Weekend Restock", atTime(addDays(currentWeekStart, 5), 8), atTime(addDays(currentWeekStart, 5), 16), "Supply Room", "Needs coverage.", "#d97706", "OPEN", null);

    // Swap request
    const swapId = genId();
    await insertShift(orgId, swapId, "Saturday Ward Coverage", atTime(addDays(currentWeekStart, 5), 7), atTime(addDays(currentWeekStart, 5), 15), "Building A", "Swap requested.", "#4f6eff", "ASSIGNED", e1.id);
    await query("INSERT INTO swap_requests (id, shift_id, requester_id, target_id, reason, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,'PENDING',NOW(),NOW())", [genId(), swapId, e1.id, e2.id, "Family commitment Saturday."]);

    console.log("Created this week's shifts");

    
    // announcements
    
    await query("INSERT INTO announcements (id, title, content, priority, organisation_id, author_id, created_at) VALUES ($1,$2,$3,'URGENT',$4,$5,NOW())", [genId(), "New PPE Protocol Effective Immediately", "All staff must wear N95 masks in surgical wings and ICU.", orgId, admin.id]);
    await query("INSERT INTO announcements (id, title, content, priority, organisation_id, author_id, created_at) VALUES ($1,$2,$3,'HIGH',$4,$5,NOW())", [genId(), "Q2 Performance Reviews Scheduled", "Manager 1-on-1s next week. Check your calendar.", orgId, admin.id]);
    await query("INSERT INTO announcements (id, title, content, priority, organisation_id, author_id, created_at) VALUES ($1,$2,$3,'NORMAL',$4,$5,NOW())", [genId(), "Cafeteria Menu Update", "New healthy options added starting Monday.", orgId, admin.id]);

    
    // messages
    
    await query("INSERT INTO messages (id, sender_id, receiver_id, content, read, created_at) VALUES ($1,$2,$3,$4,true,NOW())", [genId(), manager.id, admin.id, "Scheduled this week's shifts. Pending swap request from e1 for Saturday."]);
    await query("INSERT INTO messages (id, sender_id, receiver_id, content, read, created_at) VALUES ($1,$2,$3,$4,true,NOW())", [genId(), admin.id, manager.id, "Looks good. I'll review the swap. Processed pay period is ready."]);
    await query("INSERT INTO messages (id, sender_id, receiver_id, content, read, created_at) VALUES ($1,$2,$3,$4,false,NOW())", [genId(), e1.id, e2.id, "Can you cover my Saturday shift? Family thing."]);

    
    // pay periods
    
    const periodStart = addDays(currentWeekStart, -14);
    const periodEnd = addDays(currentWeekStart, -1);
    const periodId = genId();
    await query("INSERT INTO pay_periods (id, organisation_id, period_type, start_date, end_date, status, processed_at, created_at) VALUES ($1,$2,'BIWEEKLY',$3,$4,'PROCESSED',NOW(),NOW())", [periodId, orgId, isoDate(periodStart), isoDate(periodEnd)]);

    for (const emp of employees) {
      const empShifts = completedShifts.filter(s => s.emp.id === emp.id);
      if (empShifts.length === 0) continue;
      let totalHours = 0;
      for (const s of empShifts) totalHours += (s.end - s.start) / (1000 * 60 * 60);
      const baseHours = Math.min(totalHours, 80);
      const otHours = Math.max(0, totalHours - 80);
      const rate = emp.id === e1.id ? 28 : 26;
      const baseEarn = Math.round(baseHours * rate * 100) / 100;
      const otEarn = Math.round(otHours * rate * 1.5 * 100) / 100;
      const totalEarn = Math.round((baseEarn + otEarn) * 100) / 100;

      await query("INSERT INTO payroll_snapshots (id, pay_period_id, organisation_id, member_id, hourly_rate, overtime_multiplier, rule_daily_threshold_hours, rule_weekly_threshold_hours, rule_daily_multiplier, rule_weekly_multiplier, total_hours, base_hours, overtime_hours, base_earnings, overtime_earnings, total_earnings, generated_by, created_at) VALUES ($1,$2,$3,$4,$5,1.5,8,40,1.5,1.5,$6,$7,$8,$9,$10,$11,$12,NOW())",
        [genId(), periodId, orgId, emp.id, rate, Math.round(totalHours*100)/100, Math.round(baseHours*100)/100, Math.round(otHours*100)/100, baseEarn, otEarn, totalEarn, admin.id]);

      await query("INSERT INTO payslips (id, member_id, pay_period_id, organisation_id, base_hours, overtime_hours, overtime_rate, base_earnings, overtime_earnings, total_earnings, currency, status, generated_by, created_at) VALUES ($1,$2,$3,$4,$5,$6,1.5,$7,$8,$9,'USD','DOWNLOADED',$10,NOW())",
        [genId(), emp.id, periodId, orgId, Math.round(baseHours*100)/100, Math.round(otHours*100)/100, baseEarn, otEarn, totalEarn, admin.id]);
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
        (SELECT COUNT(*) FROM swap_requests sr JOIN shifts s ON sr.shift_id=s.id WHERE s.organisation_id=$1 AND sr.status='PENDING') as swaps`,
      [orgId]
    );

    const s = stats.rows[0];
    console.log("\n=== Scenario Seeded ===");
    console.log(`Completed: ${s.completed} | In Progress: ${s.in_progress} | Assigned: ${s.assigned} | Open: ${s.open}`);
    console.log(`Announcements: ${s.announcements} | Messages: ${s.messages}`);
    console.log(`Pay Periods: ${s.processed} processed, ${s.draft} draft | Swaps: ${s.swaps} pending`);
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
