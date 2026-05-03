const { query } = require("./client");

const seedDemoData = async () => {
  try {
    const orgResult = await query(
      "SELECT id FROM organisations WHERE name = $1 LIMIT 1",
      ["Northstar Logistics"]
    );
    const organisationId = orgResult.rows[0]?.id;
    if (!organisationId) throw new Error("Demo organisation not found");

    const membersResult = await query(
      "SELECT id, role, email, name FROM members WHERE organisation_id = $1",
      [organisationId]
    );
    const members = membersResult.rows;
    console.log(`Found ${members.length} members:`, members.map(m => `${m.name} (${m.role})`));
    
    const employees = members.filter(m => m.role === 'EMPLOYEE');
    const manager = members.find(m => m.role === 'MANAGER');
    const admin = members.find(m => m.role === 'ADMIN');

    console.log(`Found ${employees.length} employees`);
    if (employees.length === 0) throw new Error("No employees found");
    
    // Restore original roles
    const roleMap = {
      'Ava Reynolds': 'ADMIN',
      'Marco Diaz': 'MANAGER',
      'Leah Kim': 'MANAGER',
      'Owen Patel': 'EMPLOYEE',
      'Nina Lopez': 'EMPLOYEE'
    };
    
    console.log('Restoring roles...');
    for (const member of members) {
      const originalRole = roleMap[member.name];
      if (originalRole) {
        await query(
          `UPDATE members SET role = $1, updated_at = NOW() WHERE id = $2`,
          [originalRole, member.id]
        );
        console.log(`Set ${member.name} to ${originalRole} (was ${member.role})`);
      }
    }
    
    // Helper to safely get employee by index
    const getEmployee = (index) => employees[index % employees.length];

    // Clear existing demo data
    await query("DELETE FROM clock_events WHERE shift_id IN (SELECT id FROM shifts WHERE organisation_id = $1)", [organisationId]);
    await query("DELETE FROM swap_requests WHERE shift_id IN (SELECT id FROM shifts WHERE organisation_id = $1)", [organisationId]);
    await query("DELETE FROM payslips WHERE pay_period_id IN (SELECT id FROM pay_periods WHERE organisation_id = $1)", [organisationId]);
    await query("DELETE FROM pay_periods WHERE organisation_id = $1", [organisationId]);
    await query("DELETE FROM shifts WHERE organisation_id = $1", [organisationId]);
    await query("DELETE FROM announcements WHERE organisation_id = $1", [organisationId]);
    await query("DELETE FROM messages WHERE sender_id IN (SELECT id FROM members WHERE organisation_id = $1)", [organisationId]);
    await query("DELETE FROM notifications WHERE member_id IN (SELECT id FROM members WHERE organisation_id = $1)", [organisationId]);
    await query("DELETE FROM overtime_rules WHERE organisation_id = $1", [organisationId]);

    const now = new Date();
    const shifts = [];

    // Create realistic past shifts (last 2 weeks) with varied times
    for (let day = -14; day <= -1; day++) {
      const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
      const isWeekend = shiftDate.getDay() === 0 || shiftDate.getDay() === 6;
      
      // Vary shift times
      const startHour = isWeekend ? 10 : [7, 8, 9, 13, 14][Math.abs(day) % 5];
      const duration = isWeekend ? 6 : [8, 8, 8, 10, 12][Math.abs(day) % 5];
      
      const shiftStart = new Date(shiftDate.setHours(startHour, 0, 0, 0));
      const shiftEnd = new Date(shiftDate.setHours(startHour + duration, 0, 0, 0));
      
      const assignee = employees[Math.abs(day) % employees.length];

      const shiftResult = await query(
        `INSERT INTO shifts (title, start_time, end_time, status, organisation_id, assignee_id, location, color)
         VALUES ($1, $2, $3, 'COMPLETED', $4, $5, $6, $7) RETURNING id, start_time`,
        [
          `${isWeekend ? 'Weekend ' : ''}Shift ${Math.abs(day)}`,
          shiftStart,
          shiftEnd,
          organisationId,
          assignee.id,
          ['Warehouse A', 'Warehouse B', 'Front Desk', 'Loading Dock', 'Forklift Zone'][Math.abs(day) % 5],
          ['#4f6eff', '#00d4aa', '#ff6b6b', '#ffd93d', '#6bcb77'][Math.abs(day) % 5]
        ]
      );
      
      const shiftId = shiftResult.rows[0].id;
      const shiftStartTime = new Date(shiftResult.rows[0].start_time);

      // Clock in (sometimes late, sometimes early)
      const clockInOffset = [-5, -2, 0, 3, 10][Math.abs(day) % 5]; // minutes before/after shift
      const clockInTime = new Date(shiftStartTime.getTime() + clockInOffset * 60 * 1000);
      
      await query(
        `INSERT INTO clock_events (member_id, shift_id, type, timestamp)
         VALUES ($1, $2, 'CLOCK_IN', $3)`,
        [assignee.id, shiftId, clockInTime]
      );

      // Clock out (sometimes overtime)
      const clockOutTime = new Date(shiftEnd.getTime() + (duration > 8 ? 1.5 : 0) * 60 * 60 * 1000);
      
      await query(
        `INSERT INTO clock_events (member_id, shift_id, type, timestamp)
         VALUES ($1, $2, 'CLOCK_OUT', $3)`,
        [assignee.id, shiftId, clockOutTime]
      );

      shifts.push({ id: shiftId, assignee: assignee.id, date: shiftStartTime });
    }

    // Create TODAY's active shifts (morning shift clocked in, day shift in progress, evening shift not started)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Morning shift - COMPLETED
    const morningShift = new Date(today.setHours(7, 0, 0, 0));
    const morningEnd = new Date(today.setHours(15, 0, 0, 0));
    const morningResult = await query(
      `INSERT INTO shifts (title, start_time, end_time, status, organisation_id, assignee_id, location, color)
       VALUES ($1, $2, $3, 'COMPLETED', $4, $5, $6, $7) RETURNING id`,
      ['Morning Shift', morningShift, morningEnd, organisationId, getEmployee(0).id, 'Warehouse A', '#4f6eff']
    );
    await query(
      `INSERT INTO clock_events (member_id, shift_id, type, timestamp) VALUES ($1, $2, 'CLOCK_IN', $3)`,
      [getEmployee(0).id, morningResult.rows[0].id, new Date(morningShift.getTime() - 3 * 60 * 1000)]
    );
    await query(
      `INSERT INTO clock_events (member_id, shift_id, type, timestamp) VALUES ($1, $2, 'CLOCK_OUT', $3)`,
      [getEmployee(0).id, morningResult.rows[0].id, new Date(morningEnd.getTime() + 10 * 60 * 1000)]
    );

    // Day shift - IN_PROGRESS (currently active)
    const dayShift = new Date(today.setHours(9, 0, 0, 0));
    const dayEnd = new Date(today.setHours(17, 0, 0, 0));
    const dayResult = await query(
      `INSERT INTO shifts (title, start_time, end_time, status, organisation_id, assignee_id, location, color)
       VALUES ($1, $2, $3, 'IN_PROGRESS', $4, $5, $6, $7) RETURNING id`,
      ['Day Shift (Active)', dayShift, dayEnd, organisationId, getEmployee(1).id, 'Warehouse B', '#00d4aa']
    );
    await query(
      `INSERT INTO clock_events (member_id, shift_id, type, timestamp) VALUES ($1, $2, 'CLOCK_IN', $3)`,
      [getEmployee(1).id, dayResult.rows[0].id, new Date(dayShift.getTime() - 5 * 60 * 1000)]
    );

    // Evening shift - ASSIGNED (not started yet)
    const eveningShift = new Date(today.setHours(17, 0, 0, 0));
    const eveningEnd = new Date(today.setHours(23, 0, 0, 0));
    if (employees.length === 0) throw new Error("No employees found for evening shift");
    const eveningEmployee = employees[2 % employees.length];
    await query(
      `INSERT INTO shifts (title, start_time, end_time, status, organisation_id, assignee_id, location, color)
       VALUES ($1, $2, $3, 'ASSIGNED', $4, $5, $6, $7)`,
      ['Evening Shift', eveningShift, eveningEnd, organisationId, eveningEmployee.id, 'Loading Dock', '#ff6b6b']
    );

    // Tomorrow's shifts
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    for (let i = 0; i < 3; i++) {
      const start = new Date(tomorrow.setHours(8 + i * 4, 0, 0, 0));
      const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
      await query(
        `INSERT INTO shifts (title, start_time, end_time, status, organisation_id, assignee_id, location, color)
         VALUES ($1, $2, $3, 'ASSIGNED', $4, $5, $6, $7)`,
        [`Tomorrow Shift ${i + 1}`, start, end, organisationId, getEmployee(i).id, 'Warehouse A', '#ffd93d']
      );
    }

    // Create announcements (some urgent, some normal)
    if (admin) {
      await query(
        `INSERT INTO announcements (title, content, priority, organisation_id, author_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['🎉 Q1 2026 Bonus Announced', 'Great news! All employees will receive a performance bonus this quarter.', 'NORMAL', organisationId, admin.id, new Date(now - 2 * 24 * 60 * 60 * 1000)]
      );
    }

    if (manager) {
      await query(
        `INSERT INTO announcements (title, content, priority, organisation_id, author_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['⚠️ Warehouse A Closure Tomorrow', 'Warehouse A will be closed for maintenance. Use Warehouse B.', 'HIGH', organisationId, manager.id, new Date(now - 1 * 24 * 60 * 60 * 1000)]
      );
      
      await query(
        `INSERT INTO announcements (title, content, priority, organisation_id, author_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['New Overtime Policy', 'From next month, overtime will be calculated at 1.75x for weekends.', 'NORMAL', organisationId, manager.id, new Date(now - 3 * 24 * 60 * 60 * 1000)]
      );
    }

    // Create swap requests (mixed statuses)
    const pastShifts = shifts.slice(0, 5);
    if (pastShifts.length >= 2) {
      // Pending swap request
      await query(
        `INSERT INTO swap_requests (shift_id, requester_id, target_id, status, reason, created_at)
         VALUES ($1, $2, $3, 'PENDING', 'Family emergency', $4)`,
        [pastShifts[0].id, getEmployee(0).id, getEmployee(1).id, new Date(now - 1 * 24 * 60 * 60 * 1000)]
      );

      // Approved swap request
      await query(
        `INSERT INTO swap_requests (shift_id, requester_id, target_id, status, reason, created_at)
         VALUES ($1, $2, $3, 'APPROVED', 'Schedule conflict', $4)`,
        [pastShifts[1].id, getEmployee(1).id, getEmployee(2).id, new Date(now - 3 * 24 * 60 * 60 * 1000)]
      );
    }

    // Create messages between team members (messages table doesn't have organisation_id)
    if (employees.length >= 2) {
      for (let i = 0; i < employees.length - 1; i++) {
        await query(
          `INSERT INTO messages (sender_id, receiver_id, content, created_at, read)
           VALUES ($1, $2, $3, $4, $5)`,
          [getEmployee(i).id, getEmployee(i + 1).id, `Hey! Can you cover my shift on Friday?`, new Date(now - 2 * 24 * 60 * 60 * 1000), false]
        );
        await query(
          `INSERT INTO messages (sender_id, receiver_id, content, created_at, read)
           VALUES ($1, $2, $3, $4, $5)`,
          [getEmployee(i + 1).id, getEmployee(i).id, `Sure, I'll check my schedule!`, new Date(now - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), true]
        );
      }
    }

    // Create overtime rule
    await query(
      `INSERT INTO overtime_rules (organisation_id, name, daily_threshold_hours, weekly_threshold_hours, daily_multiplier, weekly_multiplier, is_active)
       VALUES ($1, 'Standard Overtime', 8, 40, 1.5, 1.5, true)`,
      [organisationId]
    );

    // Create processed pay periods with payslips
    for (let i = 0; i < 2; i++) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - 1 + i, 0);
      
      const payPeriodResult = await query(
        `INSERT INTO pay_periods (organisation_id, period_type, start_date, end_date, status)
         VALUES ($1, 'BIWEEKLY', $2, $3, 'PAID') RETURNING id`,
        [organisationId, startDate, endDate]
      );

      // Create payslips for each employee
      for (const emp of employees) {
        const baseHours = 80 + Math.floor(Math.random() * 20);
        const overtimeHours = Math.floor(Math.random() * 10);
        const baseRate = parseFloat(emp.hourly_rate) || 25;
        
        await query(
          `INSERT INTO payslips (member_id, pay_period_id, organisation_id, base_hours, overtime_hours, overtime_rate, base_earnings, overtime_earnings, total_earnings, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'GENERATED')`,
          [emp.id, payPeriodResult.rows[0].id, organisationId, baseHours, overtimeHours, 1.5, baseHours * baseRate, overtimeHours * baseRate * 1.5, (baseHours * baseRate) + (overtimeHours * baseRate * 1.5)]
        );
      }
    }

    console.log("✅ Realistic demo data seeded successfully!");
    console.log("   - 14+ past shifts with attendance records");
    console.log("   - 3 active shifts today (1 completed, 1 in-progress, 1 upcoming)");
    console.log("   - 3 future shifts tomorrow");
    console.log("   - 3 announcements (mixed priorities)");
    console.log("   - 2 swap requests (1 pending, 1 approved)");
    console.log("   - Messages between team members");
    console.log("   - 2 processed pay periods with payslips");
  } catch (error) {
    console.error("❌ Failed to seed demo data:", error.message);
    throw error;
  }
};

module.exports = { seedDemoData };
