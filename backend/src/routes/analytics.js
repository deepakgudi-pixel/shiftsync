const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/overview", requireAuth, requireRole("ADMIN","MANAGER"), async (req, res) => {
  try {
    const orgId = req.member.organisation_id;
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [members, weekShifts, openShifts, monthDone, activeNow, hoursResult, byDayResult] = await Promise.all([
      query("SELECT COUNT(*) FROM members WHERE organisation_id=$1", [orgId]),
      query("SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND start_time>=$2", [orgId, startOfWeek]),
      query("SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='OPEN'", [orgId]),
      query("SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='COMPLETED' AND start_time>=$2", [orgId, startOfMonth]),
      query("SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='IN_PROGRESS'", [orgId]),
      query(`SELECT SUM(EXTRACT(EPOCH FROM (co.timestamp-ci.timestamp))/3600) as total_hours,
              SUM(CASE WHEN m.hourly_rate IS NOT NULL THEN EXTRACT(EPOCH FROM (co.timestamp-ci.timestamp))/3600*m.hourly_rate ELSE 0 END) as total_cost
             FROM shifts s JOIN members m ON s.assignee_id=m.id
             JOIN clock_events ci ON s.id=ci.shift_id AND ci.type='CLOCK_IN'
             JOIN clock_events co ON s.id=co.shift_id AND co.type='CLOCK_OUT'
             WHERE s.organisation_id=$1 AND s.start_time>=$2`, [orgId, startOfMonth]),
      query(`SELECT EXTRACT(DOW FROM start_time) as dow, COUNT(*) as total,
              COUNT(*) FILTER (WHERE status='COMPLETED') as completed
             FROM shifts WHERE organisation_id=$1 AND start_time>=$2 GROUP BY dow ORDER BY dow`, [orgId, startOfMonth]),
    ]);
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const byDay = days.map((day,i) => {
      const f = byDayResult.rows.find(r => parseInt(r.dow)===i);
      return { day, total: parseInt(f?.total||0), completed: parseInt(f?.completed||0) };
    });
    res.json({
      totalMembers: parseInt(members.rows[0].count),
      shiftsThisWeek: parseInt(weekShifts.rows[0].count),
      openShifts: parseInt(openShifts.rows[0].count),
      completedThisMonth: parseInt(monthDone.rows[0].count),
      activeNow: parseInt(activeNow.rows[0].count),
      totalHours: Math.round((parseFloat(hoursResult.rows[0]?.total_hours)||0)*10)/10,
      totalLaborCost: Math.round(parseFloat(hoursResult.rows[0]?.total_cost)||0),
      shiftsByDay: byDay,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
