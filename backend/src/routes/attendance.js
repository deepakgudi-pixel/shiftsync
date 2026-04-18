const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");

router.post("/clock-in", requireAuth, async (req, res) => {
  try {
    const { shiftId, latitude, longitude } = req.body;
    const shift = await query("SELECT * FROM shifts WHERE id=$1 AND assignee_id=$2 AND status='ASSIGNED'", [shiftId, req.member.id]);
    if (!shift.rows.length) return res.status(404).json({ error: "Shift not found" });
    const already = await query("SELECT id FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'", [shiftId, req.member.id]);
    if (already.rows.length) return res.status(409).json({ error: "Already clocked in" });
    const result = await query("INSERT INTO clock_events (member_id,shift_id,type,latitude,longitude) VALUES ($1,$2,'CLOCK_IN',$3,$4) RETURNING *",
      [req.member.id, shiftId, latitude||null, longitude||null]);
    await query("UPDATE shifts SET status='IN_PROGRESS' WHERE id=$1", [shiftId]);
    req.io.to(`org:${req.member.organisation_id}`).emit("attendance:clockIn", { memberId: req.member.id, memberName: req.member.name, shiftId });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed to clock in" }); }
});

router.post("/clock-out", requireAuth, async (req, res) => {
  try {
    const { shiftId, latitude, longitude } = req.body;
    const clockIn = await query("SELECT * FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN'", [shiftId, req.member.id]);
    if (!clockIn.rows.length) return res.status(409).json({ error: "Not clocked in" });
    const result = await query("INSERT INTO clock_events (member_id,shift_id,type,latitude,longitude) VALUES ($1,$2,'CLOCK_OUT',$3,$4) RETURNING *",
      [req.member.id, shiftId, latitude||null, longitude||null]);
    const hoursWorked = (new Date(result.rows[0].timestamp) - new Date(clockIn.rows[0].timestamp)) / 3600000;
    await query("UPDATE shifts SET status='COMPLETED' WHERE id=$1", [shiftId]);
    if (hoursWorked > 8) {
      await query("INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,'OVERTIME_ALERT','Overtime Detected',$2,$3)",
        [req.member.id, `You worked ${hoursWorked.toFixed(1)} hours`, JSON.stringify({ shiftId, hoursWorked })]);
    }
    req.io.to(`org:${req.member.organisation_id}`).emit("attendance:clockOut", { memberId: req.member.id, shiftId, hoursWorked });
    res.json({ ...result.rows[0], hoursWorked });
  } catch (err) { res.status(500).json({ error: "Failed to clock out" }); }
});

router.get("/live", requireAuth, requireRole("ADMIN","MANAGER"), async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, m.name as member_name, m.avatar_url, ce.timestamp as clocked_in_at
       FROM shifts s JOIN members m ON s.assignee_id=m.id
       JOIN clock_events ce ON s.id=ce.shift_id AND ce.type='CLOCK_IN'
       WHERE s.organisation_id=$1 AND s.status='IN_PROGRESS' ORDER BY ce.timestamp DESC`,
      [req.member.organisation_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.get("/timesheet/me", requireAuth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start ? new Date(start) : new Date(new Date().setDate(1));
    const endDate = end ? new Date(end) : new Date();
    const result = await query(
      `SELECT s.id, s.title, s.start_time, s.color,
        ci.timestamp as clock_in, co.timestamp as clock_out
       FROM shifts s
       LEFT JOIN clock_events ci ON s.id=ci.shift_id AND ci.type='CLOCK_IN'
       LEFT JOIN clock_events co ON s.id=co.shift_id AND co.type='CLOCK_OUT'
       WHERE s.assignee_id=$1 AND s.status='COMPLETED' AND s.start_time>=$2 AND s.start_time<=$3
       ORDER BY s.start_time ASC`,
      [req.member.id, startDate, endDate]
    );
    const timesheet = result.rows.map(row => {
      const hours = row.clock_in && row.clock_out ? (new Date(row.clock_out) - new Date(row.clock_in)) / 3600000 : 0;
      return { ...row, hoursWorked: Math.round(hours * 100) / 100 };
    });
    const totalHours = Math.round(timesheet.reduce((s, t) => s + t.hoursWorked, 0) * 100) / 100;
    res.json({ timesheet, totalHours });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.get("/timesheet", requireAuth, requireRole("ADMIN","MANAGER"), async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start ? new Date(start) : new Date(new Date().setDate(1));
    const endDate = end ? new Date(end) : new Date();
    const result = await query(
      `SELECT m.id as member_id, m.name, m.avatar_url, m.hourly_rate,
        s.id as shift_id, s.title, s.start_time,
        ci.timestamp as clock_in, co.timestamp as clock_out
       FROM members m
       LEFT JOIN shifts s ON m.id=s.assignee_id AND s.status='COMPLETED' AND s.start_time>=$2 AND s.start_time<=$3
       LEFT JOIN clock_events ci ON s.id=ci.shift_id AND ci.type='CLOCK_IN'
       LEFT JOIN clock_events co ON s.id=co.shift_id AND co.type='CLOCK_OUT'
       WHERE m.organisation_id=$1 ORDER BY m.name, s.start_time`,
      [req.member.organisation_id, startDate, endDate]
    );
    const grouped = {};
    result.rows.forEach(row => {
      if (!grouped[row.member_id]) grouped[row.member_id] = { id: row.member_id, name: row.name, avatarUrl: row.avatar_url, hourlyRate: row.hourly_rate, shifts: [], totalHours: 0 };
      if (row.shift_id) {
        const hours = row.clock_in && row.clock_out ? (new Date(row.clock_out) - new Date(row.clock_in)) / 3600000 : 0;
        grouped[row.member_id].shifts.push({ ...row, hoursWorked: Math.round(hours * 100) / 100 });
        grouped[row.member_id].totalHours += hours;
      }
    });
    Object.values(grouped).forEach(m => {
      m.totalHours = Math.round(m.totalHours * 100) / 100;
      m.totalEarnings = m.hourlyRate ? Math.round(m.totalHours * m.hourlyRate) : null;
    });
    res.json(Object.values(grouped));
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
