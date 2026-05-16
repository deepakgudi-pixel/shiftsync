const { query, pool } = require("../db/client");
const { emitEvent } = require("../lib/eventEmitter");
const { EVENT_TYPES } = require("../lib/events");

const findShiftForClockIn = async (shiftId, memberId, client) => {
  const result = await client.query(
    "SELECT * FROM shifts WHERE id=$1 AND assignee_id=$2 AND (status='ASSIGNED' OR status='OPEN') FOR UPDATE",
    [shiftId, memberId]
  );
  return result.rows[0] || null;
};

const findExistingClockIn = async (shiftId, memberId, client) => {
  const result = await client.query(
    "SELECT id, timestamp FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'",
    [shiftId, memberId]
  );
  return result.rows[0] || null;
};

const createClockEvent = async (client, memberId, shiftId, type, latitude, longitude) => {
  const result = await client.query(
    `INSERT INTO clock_events (member_id, shift_id, type, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [memberId, shiftId, type, latitude || null, longitude || null]
  );
  return result.rows[0];
};

const updateShiftStatus = async (client, shiftId, status) => {
  await client.query(
    "UPDATE shifts SET status=$1, updated_at=NOW() WHERE id=$2",
    [status, shiftId]
  );
};

const emitClockEvents = async (client, orgId, memberId, eventType, entityType, entityId, payload, req) => {
  await emitEvent({
    client,
    organisationId: orgId,
    memberId,
    eventType,
    entityType,
    entityId,
    payload,
    req,
  });
};

const createOvertimeNotification = async (client, memberId, hoursWorked, shiftId) => {
  await client.query(
    "INSERT INTO notifications (member_id, type, title, body, data) VALUES ($1, 'OVERTIME_ALERT', 'Overtime Detected', $2, $3)",
    [
      memberId,
      `You worked ${hoursWorked.toFixed(1)} hours`,
      JSON.stringify({ shiftId, hoursWorked }),
    ]
  );
};

const clockIn = async (memberId, orgId, shiftId, latitude, longitude, req) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const shift = await findShiftForClockIn(shiftId, memberId, client);
    if (!shift) {
      await client.query("ROLLBACK");
      return { status: 404, body: { error: "Shift not found or not assigned to you" } };
    }

    const existing = await findExistingClockIn(shiftId, memberId, client);
    if (existing) {
      await client.query("ROLLBACK");
      return { status: 409, body: { error: "Already clocked in" } };
    }

    const ce = await createClockEvent(client, memberId, shiftId, "CLOCK_IN", latitude, longitude);
    await updateShiftStatus(client, shiftId, "IN_PROGRESS");

    await emitClockEvents(
      client, orgId, memberId,
      EVENT_TYPES.CLOCK_IN,
      "clock_event",
      ce.id,
      { shiftId, memberId, timestamp: ce.timestamp },
      req
    );

    await emitClockEvents(
      client, orgId, memberId,
      EVENT_TYPES.SHIFT_CLOCK_IN,
      "shift",
      shiftId,
      { shiftId, memberId },
      req
    );

    await client.query("COMMIT");
    return { status: 201, body: ce };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const clockOut = async (memberId, orgId, shiftId, latitude, longitude, req) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const clockIn = await findExistingClockIn(shiftId, memberId, client);
    if (!clockIn) {
      await client.query("ROLLBACK");
      return { status: 409, body: { error: "Not clocked in" } };
    }

    const ce = await createClockEvent(client, memberId, shiftId, "CLOCK_OUT", latitude, longitude);
    const hoursWorked =
      (new Date(ce.timestamp).getTime() - new Date(clockIn.timestamp).getTime()) / 3600000;

    await updateShiftStatus(client, shiftId, "COMPLETED");

    await emitClockEvents(
      client, orgId, memberId,
      EVENT_TYPES.CLOCK_OUT,
      "clock_event",
      ce.id,
      { shiftId, memberId, hoursWorked },
      req
    );

    await emitClockEvents(
      client, orgId, memberId,
      EVENT_TYPES.SHIFT_CLOCK_OUT,
      "shift",
      shiftId,
      { shiftId, memberId, hoursWorked },
      req
    );

    if (hoursWorked > 8) {
      await createOvertimeNotification(client, memberId, hoursWorked, shiftId);
    }

    await client.query("COMMIT");
    return { status: 200, body: { ...ce, hoursWorked } };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const findLiveAttendance = async (orgId) => {
  const result = await query(
    `SELECT s.*, m.name as member_name, m.avatar_url, ce.timestamp as clocked_in_at
     FROM shifts s JOIN members m ON s.assignee_id=m.id
     JOIN clock_events ce ON s.id=ce.shift_id AND ce.type='CLOCK_IN'
     WHERE s.organisation_id=$1 AND s.status='IN_PROGRESS' ORDER BY ce.timestamp DESC`,
    [orgId]
  );
  return result.rows;
};

const findMyTimesheet = async (memberId, startDate, endDate) => {
  const result = await query(
    `SELECT s.id, s.title, s.start_time, s.color,
       ci.timestamp as clock_in,
       co.timestamp as clock_out,
       EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp))/3600 as hours_worked
     FROM shifts s
     LEFT JOIN clock_events ci ON s.id = ci.shift_id AND ci.type = 'CLOCK_IN'
     LEFT JOIN clock_events co ON s.id = co.shift_id AND co.type = 'CLOCK_OUT'
     WHERE s.assignee_id = $1
     AND s.status = 'COMPLETED'
     AND ci.timestamp >= $2
     AND ci.timestamp <= $3
     ORDER BY s.start_time ASC`,
    [memberId, startDate, endDate]
  );

  const timesheet = result.rows.map((row) => ({
    ...row,
    hoursWorked: Math.round((parseFloat(row.hours_worked) || 0) * 100) / 100,
  }));

  const totalHours = Math.round(timesheet.reduce((s, t) => s + t.hoursWorked, 0) * 100) / 100;
  return { timesheet, totalHours };
};

const findTeamTimesheet = async (orgId, startDate, endDate, role, memberId) => {
  const result = await query(
    `SELECT m.id as member_id, m.name, m.avatar_url,
       CASE WHEN $4 = 'ADMIN' OR m.id = $5 OR ($4 = 'MANAGER' AND m.role = 'EMPLOYEE') THEN m.hourly_rate ELSE NULL END as hourly_rate,
       s.id as shift_id, s.title, s.start_time,
       ci.timestamp as clock_in,
       co.timestamp as clock_out,
       EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp))/3600 as hours_worked
     FROM members m
     LEFT JOIN shifts s ON m.id = s.assignee_id
       AND s.status = 'COMPLETED'
     LEFT JOIN clock_events ci ON s.id = ci.shift_id AND ci.type = 'CLOCK_IN'
     LEFT JOIN clock_events co ON s.id = co.shift_id AND co.type = 'CLOCK_OUT'
     WHERE m.organisation_id = $1
       AND (ci.timestamp IS NULL OR ci.timestamp >= $2)
       AND (ci.timestamp IS NULL OR ci.timestamp <= $3)
     ORDER BY m.name, s.start_time`,
    [orgId, startDate, endDate, role, memberId]
  );

  const grouped = {};
  result.rows.forEach((row) => {
    if (!grouped[row.member_id]) {
      grouped[row.member_id] = {
        id: row.member_id,
        name: row.name,
        avatarUrl: row.avatar_url,
        hourlyRate: row.hourly_rate,
        shifts: [],
        totalHours: 0,
      };
    }
    if (row.shift_id && row.clock_in) {
      const hours = Math.round((parseFloat(row.hours_worked) || 0) * 100) / 100;
      grouped[row.member_id].shifts.push({ ...row, hoursWorked: hours });
      grouped[row.member_id].totalHours += hours;
    }
  });

  Object.values(grouped).forEach((m) => {
    m.totalHours = Math.round(m.totalHours * 100) / 100;
    m.totalEarnings = m.hourlyRate ? Math.round(m.totalHours * m.hourlyRate) : null;
  });

  return Object.values(grouped);
};

const findCompletedShiftsDebug = async (orgId) => {
  const result = await query(
    `SELECT s.title, s.status, m.name,
       ci.timestamp as clock_in,
       co.timestamp as clock_out,
       EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp))/3600 as hours
     FROM shifts s
     LEFT JOIN members m ON s.assignee_id = m.id
     LEFT JOIN clock_events ci ON s.id = ci.shift_id AND ci.type = 'CLOCK_IN'
     LEFT JOIN clock_events co ON s.id = co.shift_id AND co.type = 'CLOCK_OUT'
     WHERE s.status = 'COMPLETED' AND s.organisation_id = $1`,
    [orgId]
  );
  return result.rows;
};

const findRecentShiftsDebug = async (orgId, sinceDate) => {
  const result = await query(
    `SELECT m.name, m.hourly_rate,
       s.id as shift_id, s.title, s.status, s.start_time,
       ci.timestamp as clock_in,
       co.timestamp as clock_out,
       EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp))/3600 as hours
     FROM members m
     LEFT JOIN shifts s ON m.id = s.assignee_id
       AND s.status = 'COMPLETED'
       AND s.start_time >= $1
       AND s.organisation_id = $2
     LEFT JOIN clock_events ci ON s.id = ci.shift_id AND ci.type = 'CLOCK_IN'
     LEFT JOIN clock_events co ON s.id = co.shift_id AND co.type = 'CLOCK_OUT'
     WHERE m.organisation_id = $2
     ORDER BY m.name`,
    [sinceDate, orgId]
  );
  return result.rows;
};

module.exports = {
  clockIn,
  clockOut,
  findLiveAttendance,
  findMyTimesheet,
  findTeamTimesheet,
  findCompletedShiftsDebug,
  findRecentShiftsDebug,
};
