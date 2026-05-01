const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");

const ANALYTICS_WINDOW_DAYS = 30;

router.get("/overview", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const orgId = req.member.organisation_id;
    const now = new Date();

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const analyticsWindowStart = new Date(now);
    analyticsWindowStart.setDate(now.getDate() - (ANALYTICS_WINDOW_DAYS - 1));
    analyticsWindowStart.setHours(0, 0, 0, 0);

    const [members, weekShifts, openShifts, assignedShifts, completedRecent, activeNow, hoursResult, byDayResult] = await Promise.all([
      query("SELECT COUNT(*) FROM members WHERE organisation_id=$1", [orgId]),
      query("SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND start_time>=$2", [orgId, startOfWeek]),
      query("SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='OPEN'", [orgId]),
      query("SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='ASSIGNED'", [orgId]),
      query("SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='COMPLETED' AND start_time>=$2", [orgId, analyticsWindowStart]),
      query("SELECT COUNT(*) FROM shifts WHERE organisation_id=$1 AND status='IN_PROGRESS'", [orgId]),
      query(
        `SELECT SUM(EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp)) / 3600) AS total_hours,
                SUM(
                  CASE
                    WHEN m.hourly_rate IS NOT NULL THEN EXTRACT(EPOCH FROM (co.timestamp - ci.timestamp)) / 3600 * m.hourly_rate
                    ELSE 0
                  END
                ) AS total_cost
           FROM shifts s
           JOIN members m ON s.assignee_id = m.id
           JOIN clock_events ci ON s.id = ci.shift_id AND ci.type = 'CLOCK_IN'
           JOIN clock_events co ON s.id = co.shift_id AND co.type = 'CLOCK_OUT'
          WHERE s.organisation_id = $1 AND s.start_time >= $2`,
        [orgId, analyticsWindowStart]
      ),
      query(
        `SELECT EXTRACT(DOW FROM start_time) AS dow,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed
           FROM shifts
          WHERE organisation_id = $1 AND start_time >= $2
          GROUP BY dow
          ORDER BY dow`,
        [orgId, analyticsWindowStart]
      ),
    ]);

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const byDay = days.map((day, index) => {
      const found = byDayResult.rows.find((row) => parseInt(row.dow, 10) === index);
      return {
        day,
        total: parseInt(found?.total || 0, 10),
        completed: parseInt(found?.completed || 0, 10),
      };
    });

    res.json({
      totalMembers: parseInt(members.rows[0].count, 10),
      shiftsThisWeek: parseInt(weekShifts.rows[0].count, 10),
      openShifts: parseInt(openShifts.rows[0].count, 10),
      assignedShifts: parseInt(assignedShifts.rows[0].count, 10),
      completedThisMonth: parseInt(completedRecent.rows[0].count, 10),
      activeNow: parseInt(activeNow.rows[0].count, 10),
      totalHours: Math.round((parseFloat(hoursResult.rows[0]?.total_hours) || 0) * 10) / 10,
      totalLaborCost: Math.round(parseFloat(hoursResult.rows[0]?.total_cost) || 0),
      shiftsByDay: byDay,
      analyticsWindowDays: ANALYTICS_WINDOW_DAYS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

module.exports = router;
