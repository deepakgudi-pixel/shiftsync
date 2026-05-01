const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { query } = require("../db/client");

const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
const DEV_HEADER = "x-dev-clerk-user-id";

const DEMO_EMAILS = {
  admin: "demo.admin.northstar+clerk_test@example.com",
  manager: "demo.manager.northstar+clerk_test@example.com",
  leah: "demo.leah.northstar+clerk_test@example.com",
  nina: "demo.nina.northstar+clerk_test@example.com",
  owen: "demo.owen.northstar+clerk_test@example.com",
};

const request = async (pathname, options = {}) => {
  const { clerkUserId, headers, ...rest } = options;
  const finalHeaders = {
    "Content-Type": "application/json",
    ...(headers || {}),
  };

  if (clerkUserId) {
    finalHeaders[DEV_HEADER] = clerkUserId;
    finalHeaders.Host = `localhost:${process.env.PORT || 4000}`;
  }

  const response = await fetch(`${BASE_URL}${pathname}`, {
    ...rest,
    headers: finalHeaders,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/pdf")
    ? Buffer.from(await response.arrayBuffer())
    : contentType.includes("application/json")
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText} on ${pathname}: ${typeof data === "string" ? data : JSON.stringify(data)}`
    );
  }

  return data;
};

const getDemoMembers = async () => {
  const result = await query(
    `SELECT m.*, o.name as organisation_name, o.currency
     FROM members m
     JOIN organisations o ON o.id = m.organisation_id
     WHERE m.email = ANY($1::text[])`,
    [Object.values(DEMO_EMAILS)]
  );

  const byEmail = Object.fromEntries(result.rows.map((row) => [row.email, row]));
  const members = {
    admin: byEmail[DEMO_EMAILS.admin],
    manager: byEmail[DEMO_EMAILS.manager],
    leah: byEmail[DEMO_EMAILS.leah],
    nina: byEmail[DEMO_EMAILS.nina],
    owen: byEmail[DEMO_EMAILS.owen],
  };

  const missing = Object.entries(members)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(
      `Missing demo accounts (${missing.join(", ")}). Run "npm run db:seed" first.`
    );
  }

  const organisationIds = new Set(Object.values(members).map((member) => member.organisation_id));
  if (organisationIds.size !== 1) {
    throw new Error("Demo accounts are not in the same organisation.");
  }

  return members;
};

const ensureFreshScenario = async (organisationId) => {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM shifts WHERE organisation_id = $1) as shift_count,
       (SELECT COUNT(*) FROM announcements WHERE organisation_id = $1) as announcement_count,
       (SELECT COUNT(*) FROM pay_periods WHERE organisation_id = $1) as pay_period_count,
       (SELECT COUNT(*) FROM messages msg
          WHERE msg.sender_id IN (SELECT id FROM members WHERE organisation_id = $1)) as message_count`,
    [organisationId]
  );

  const row = result.rows[0];
  const hasExistingData = Object.values(row).some((value) => parseInt(value, 10) > 0);

  if (hasExistingData) {
    throw new Error(
      "Demo scenario data already exists for Northstar Logistics. Clear the data tables first, then rerun this script."
    );
  }
};

const mondayOfWeek = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value;
};

const atTime = (base, hour, minute = 0) => {
  const value = new Date(base);
  value.setHours(hour, minute, 0, 0);
  return value;
};

const addDays = (base, days) => {
  const value = new Date(base);
  value.setDate(value.getDate() + days);
  return value;
};

const isoDate = (date) => date.toISOString().slice(0, 10);

const createShift = async ({ actor, title, start, end, location, notes, color, assigneeId }) => {
  const payload = {
    title,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    location,
    notes,
    color,
  };

  if (assigneeId) {
    payload.assigneeId = assigneeId;
  }

  return request("/api/shifts", {
    method: "POST",
    clerkUserId: actor.clerk_user_id,
    body: JSON.stringify(payload),
  });
};

const completeShift = async ({ shiftId, member, start, end }) => {
  await request("/api/attendance/clock-in", {
    method: "POST",
    clerkUserId: member.clerk_user_id,
    body: JSON.stringify({ shiftId }),
  });

  await request("/api/attendance/clock-out", {
    method: "POST",
    clerkUserId: member.clerk_user_id,
    body: JSON.stringify({ shiftId }),
  });

  await query(
    `UPDATE clock_events
     SET timestamp = CASE
       WHEN type = 'CLOCK_IN' THEN $1
       WHEN type = 'CLOCK_OUT' THEN $2
       ELSE timestamp
     END
     WHERE shift_id = $3 AND member_id = $4`,
    [start.toISOString(), end.toISOString(), shiftId, member.id]
  );
};

const createAvailability = async (memberId, startTime, endTime) => {
  for (let day = 1; day <= 5; day += 1) {
    await query(
      `INSERT INTO availability (member_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4)`,
      [memberId, day, startTime, endTime]
    );
  }
};

const main = async () => {
  try {
    const members = await getDemoMembers();
    const organisationId = members.admin.organisation_id;

    await ensureFreshScenario(organisationId);

    const today = new Date();
    const currentWeekStart = mondayOfWeek(today);
    const previousWeekStart = addDays(currentWeekStart, -7);
    const previousWeekEnd = addDays(previousWeekStart, 6);
    const currentWeekEnd = addDays(currentWeekStart, 6);

    const previousWedStart = atTime(addDays(previousWeekStart, 2), 8, 0);
    const previousWedEnd = atTime(addDays(previousWeekStart, 2), 17, 0);
    const previousThuStart = atTime(addDays(previousWeekStart, 3), 7, 30);
    const previousThuEnd = atTime(addDays(previousWeekStart, 3), 16, 0);
    const currentTueStart = atTime(addDays(currentWeekStart, 1), 7, 0);
    const currentTueEnd = atTime(addDays(currentWeekStart, 1), 15, 30);
    const currentWedStart = atTime(addDays(currentWeekStart, 2), 12, 0);
    const currentWedEnd = atTime(addDays(currentWeekStart, 2), 18, 0);
    const liveShiftStart = new Date(today.getTime() - 60 * 60 * 1000);
    const liveShiftEnd = new Date(today.getTime() + 3 * 60 * 60 * 1000);
    const futureMorningStart = atTime(addDays(today, 1), 9, 0);
    const futureMorningEnd = atTime(addDays(today, 1), 13, 0);
    const futureDispatchStart = atTime(addDays(today, 1), 14, 0);
    const futureDispatchEnd = atTime(addDays(today, 1), 22, 0);
    const futureWeekendStart = atTime(addDays(today, 2), 8, 0);
    const futureWeekendEnd = atTime(addDays(today, 2), 16, 0);

    await query("UPDATE organisations SET currency = $1, updated_at = NOW() WHERE id = $2", ["USD", organisationId]);
    await createAvailability(members.leah.id, "08:00", "17:00");
    await createAvailability(members.nina.id, "09:00", "18:00");
    await createAvailability(members.owen.id, "07:00", "16:00");

    await request("/api/overtime", {
      method: "POST",
      clerkUserId: members.admin.clerk_user_id,
      body: JSON.stringify({
        name: "Northstar Standard Overtime",
        daily_threshold_hours: 8,
        weekly_threshold_hours: 40,
        daily_multiplier: 1.5,
        weekly_multiplier: 1.5,
        is_active: true,
      }),
    });

    for (const [member, rate, multiplier] of [
      [members.leah, 24, 1.5],
      [members.nina, 23, 1.5],
      [members.owen, 27, 1.75],
    ]) {
      await request("/api/payroll/employee-rates", {
        method: "POST",
        clerkUserId: members.admin.clerk_user_id,
        body: JSON.stringify({
          member_id: member.id,
          hourly_rate: rate,
          overtime_multiplier: multiplier,
          effective_from: isoDate(previousWeekStart),
        }),
      });
    }

    await request("/api/organisations/announcements", {
      method: "POST",
      clerkUserId: members.admin.clerk_user_id,
      body: JSON.stringify({
        title: "Dock 3 Safety Walkthrough at 4 PM",
        content:
          "Supervisors should meet at Dock 3 for the new loading-bay safety walkthrough before the evening dispatch block begins.",
        priority: "URGENT",
      }),
    });

    await request("/api/organisations/announcements", {
      method: "POST",
      clerkUserId: members.admin.clerk_user_id,
      body: JSON.stringify({
        title: "Weekend restock coverage needed",
        content:
          "Leah requested coverage on Saturday's restock shift. Marco should review the pending swap request before finalizing weekend staffing.",
        priority: "HIGH",
      }),
    });

    await request("/api/messages", {
      method: "POST",
      clerkUserId: members.manager.clerk_user_id,
      body: JSON.stringify({
        receiverId: members.admin.id,
        content: "I seeded tomorrow's dispatch block. There is one pending swap request for weekend coverage to review.",
      }),
    });

    await request("/api/messages", {
      method: "POST",
      clerkUserId: members.admin.clerk_user_id,
      body: JSON.stringify({
        receiverId: members.manager.id,
        content: "Looks good. I will keep the urgent announcement pinned and use the processed pay period for the payroll walkthrough.",
      }),
    });

    const previousOwenShift = await createShift({
      actor: members.manager,
      title: "Inventory Count",
      start: previousWedStart,
      end: previousWedEnd,
      location: "Warehouse A",
      notes: "Cycle count for fast-moving SKUs.",
      color: "#059669",
      assigneeId: members.owen.id,
    });

    const previousLeahShift = await createShift({
      actor: members.manager,
      title: "Morning Receiving",
      start: previousThuStart,
      end: previousThuEnd,
      location: "Receiving Dock",
      notes: "Unload inbound pallets and reconcile manifests.",
      color: "#4f6eff",
      assigneeId: members.leah.id,
    });

    const currentLeahShift = await createShift({
      actor: members.manager,
      title: "Returns Sorting",
      start: currentTueStart,
      end: currentTueEnd,
      location: "Returns Bay",
      notes: "Sort and relabel returned inventory.",
      color: "#be185d",
      assigneeId: members.leah.id,
    });

    const currentOwenShift = await createShift({
      actor: members.manager,
      title: "Loading Bay Audit",
      start: currentWedStart,
      end: currentWedEnd,
      location: "Loading Bay",
      notes: "Check outbound staging and seal logs.",
      color: "#0891b2",
      assigneeId: members.owen.id,
    });

    await completeShift({
      shiftId: previousOwenShift.id,
      member: members.owen,
      start: previousWedStart,
      end: previousWedEnd,
    });

    await completeShift({
      shiftId: previousLeahShift.id,
      member: members.leah,
      start: previousThuStart,
      end: previousThuEnd,
    });

    await completeShift({
      shiftId: currentLeahShift.id,
      member: members.leah,
      start: currentTueStart,
      end: currentTueEnd,
    });

    await completeShift({
      shiftId: currentOwenShift.id,
      member: members.owen,
      start: currentWedStart,
      end: currentWedEnd,
    });

    const liveShift = await createShift({
      actor: members.manager,
      title: "Live Floor Coverage",
      start: liveShiftStart,
      end: liveShiftEnd,
      location: "Fulfillment Floor",
      notes: "Nina is currently active so the live attendance panel has real data.",
      color: "#dc2626",
      assigneeId: members.nina.id,
    });

    await request("/api/attendance/clock-in", {
      method: "POST",
      clerkUserId: members.nina.clerk_user_id,
      body: JSON.stringify({ shiftId: liveShift.id }),
    });

    await query(
      `UPDATE clock_events SET timestamp = $1 WHERE shift_id = $2 AND member_id = $3 AND type = 'CLOCK_IN'`,
      [liveShiftStart.toISOString(), liveShift.id, members.nina.id]
    );

    await createShift({
      actor: members.manager,
      title: "Cold Storage Check",
      start: futureMorningStart,
      end: futureMorningEnd,
      location: "Cold Room 2",
      notes: "Open slot to demonstrate coverage gaps.",
      color: "#d97706",
    });

    await createShift({
      actor: members.manager,
      title: "Evening Dispatch",
      start: futureDispatchStart,
      end: futureDispatchEnd,
      location: "Dispatch Dock",
      notes: "Assigned future shift for the schedule board.",
      color: "#7c3aed",
      assigneeId: members.owen.id,
    });

    const swapShift = await createShift({
      actor: members.manager,
      title: "Weekend Restock",
      start: futureWeekendStart,
      end: futureWeekendEnd,
      location: "Warehouse B",
      notes: "Leah requested cover from Owen so managers can review a pending swap.",
      color: "#4f6eff",
      assigneeId: members.leah.id,
    });

    await request(`/api/shifts/${swapShift.id}/swap`, {
      method: "POST",
      clerkUserId: members.leah.clerk_user_id,
      body: JSON.stringify({
        reason: "Need coverage for a family commitment on Saturday morning.",
        targetId: members.owen.id,
      }),
    });

    const previousPeriod = await request("/api/payroll/pay-periods", {
      method: "POST",
      clerkUserId: members.admin.clerk_user_id,
      body: JSON.stringify({
        period_type: "WEEKLY",
        start_date: isoDate(previousWeekStart),
        end_date: isoDate(previousWeekEnd),
      }),
    });

    await request(`/api/payroll/pay-periods/${previousPeriod.id}/process`, {
      method: "POST",
      clerkUserId: members.admin.clerk_user_id,
    });

    const previousPeriodPayslip = await query(
      `SELECT id
       FROM payslips
       WHERE pay_period_id = $1 AND member_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [previousPeriod.id, members.owen.id]
    );

    if (previousPeriodPayslip.rows[0]?.id) {
      await request(`/api/payslips/${previousPeriodPayslip.rows[0].id}/pdf`, {
        method: "GET",
        clerkUserId: members.admin.clerk_user_id,
        headers: { Accept: "application/pdf" },
      });
    }

    await request("/api/payroll/pay-periods", {
      method: "POST",
      clerkUserId: members.admin.clerk_user_id,
      body: JSON.stringify({
        period_type: "WEEKLY",
        start_date: isoDate(currentWeekStart),
        end_date: isoDate(currentWeekEnd),
      }),
    });

    console.log(
      JSON.stringify(
        {
          success: true,
          organisation: members.admin.organisation_name,
          visibleLogin: {
            role: members.admin.role,
            name: members.admin.name,
            email: members.admin.email,
          },
          seededState: {
            announcements: 2,
            completedShifts: 4,
            inProgressShifts: 1,
            upcomingAssignedShifts: 2,
            openShifts: 1,
            pendingSwapRequests: 1,
            processedPayPeriods: 1,
            draftPayPeriods: 1,
            directMessages: 2,
          },
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("Failed to seed demo scenario");
    console.error(error);
    process.exit(1);
  }
};

main();
