const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");
const attendanceService = require("../services/attendanceService");

router.post("/clock-in", requireAuth, async (req, res) => {
  try {
    const { shiftId, latitude, longitude } = req.body;
    if (!shiftId) return res.status(400).json({ error: "shiftId required" });

    const result = await attendanceService.clockIn(
      req.member.id,
      req.member.organisation_id,
      shiftId,
      latitude,
      longitude,
      req
    );

    req.io.to(`org:${req.member.organisation_id}`).emit("attendance:clockIn", {
      memberId: req.member.id,
      memberName: req.member.name,
      shiftId,
    });

    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "CLOCK_IN",
      entityType: "clock_event",
      entityId: result.body.id,
      newValues: result.body,
      req,
    });

    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clock in" });
  }
});

router.post("/clock-out", requireAuth, async (req, res) => {
  try {
    const { shiftId, latitude, longitude } = req.body;
    if (!shiftId) return res.status(400).json({ error: "shiftId required" });

    const result = await attendanceService.clockOut(
      req.member.id,
      req.member.organisation_id,
      shiftId,
      latitude,
      longitude,
      req
    );

    req.io.to(`org:${req.member.organisation_id}`).emit("attendance:clockOut", {
      memberId: req.member.id,
      shiftId,
      hoursWorked: result.body.hoursWorked,
    });

    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "CLOCK_OUT",
      entityType: "clock_event",
      entityId: result.body.id,
      newValues: result.body,
      req,
    });

    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clock out" });
  }
});

router.get("/live", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const live = await attendanceService.findLiveAttendance(req.member.organisation_id);
    res.json(live);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/timesheet/me", requireAuth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = end ? new Date(end) : new Date();

    const data = await attendanceService.findMyTimesheet(req.member.id, startDate, endDate);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/timesheet", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = end ? new Date(end) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const data = await attendanceService.findTeamTimesheet(
      req.member.organisation_id,
      startDate,
      endDate,
      req.member.role,
      req.member.id
    );
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// Debug endpoints — development / staging only
if (process.env.NODE_ENV !== "production") {
  router.get("/debug", requireAuth, requireRole("ADMIN"), async (req, res) => {
    try {
      const data = await attendanceService.findCompletedShiftsDebug(req.member.organisation_id);
      res.json(data);
    } catch (err) {
      console.error("[debug] completed shifts:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/debug2", requireAuth, requireRole("ADMIN"), async (req, res) => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const data = await attendanceService.findRecentShiftsDebug(req.member.organisation_id, thirtyDaysAgo);
      res.json(data);
    } catch (err) {
      console.error("[debug2] recent shifts:", err);
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = router;
