const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");
const payrollService = require("../services/payrollService");

router.get("/pay-periods", requireAuth, async (req, res) => {
  try {
    const periods = await payrollService.findPayPeriods(req.member.organisation_id);
    res.json(periods);
  } catch (err) {
    console.error("GET /pay-periods:", err);
    res.status(500).json({ error: "Failed to load pay periods" });
  }
});

router.post("/pay-periods", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { period_type, start_date, end_date } = req.body;
    if (!period_type || !start_date || !end_date) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const period = await payrollService.createPayPeriod(
      req.member.organisation_id,
      period_type,
      start_date,
      end_date
    );
    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "CREATE",
      entityType: "pay_period",
      entityId: period.id,
      newValues: period,
      req,
    });
    res.status(201).json(period);
  } catch (err) {
    console.error("POST /pay-periods:", err);
    res.status(500).json({ error: "Failed to create pay period" });
  }
});

router.get("/pay-periods/:id/timesheet", requireAuth, async (req, res) => {
  try {
    const data = await payrollService.getTimesheetData(req.params.id, req.member.organisation_id);
    if (!data) return res.status(404).json({ error: "Pay period not found" });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/pay-periods/:id/summary", requireAuth, async (req, res) => {
  try {
    const data = await payrollService.getSummaryData(req.params.id, req.member.organisation_id);
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/pay-periods/:id/process", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const result = await payrollService.processPayPeriod(
      req.params.id,
      req.member.organisation_id,
      req.member.id,
      req.clerkUserId,
      req
    );
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process period" });
  }
});

router.post("/pay-periods/:id/paid", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    await payrollService.updatePayPeriodPaid(req.params.id, req.member.organisation_id);
    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "UPDATE",
      entityType: "pay_period",
      entityId: req.params.id,
      newValues: { status: "PAID" },
      req,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("POST /pay-periods/:id/paid:", err);
    res.status(500).json({ error: "Failed to mark as paid" });
  }
});

router.delete("/pay-periods/:id/payslips", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const deleted = await payrollService.deletePayslipsAndSnapshots(
      req.params.id,
      req.member.organisation_id
    );
    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "DELETE",
      entityType: "payslip_batch",
      entityId: req.params.id,
      oldValues: { count: deleted },
      req,
    });
    res.json({ success: true, deleted });
  } catch (err) {
    console.error("DELETE /pay-periods/:id/payslips:", err);
    res.status(500).json({ error: "Failed to delete payslips" });
  }
});

router.get("/employee-rates/all", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const rows = await payrollService.findAllEmployeeRatesForOrg(req.member.organisation_id);
    res.json(rows);
  } catch (err) {
    console.error("GET /employee-rates/all:", err);
    res.status(500).json({ error: "Failed to load employee rates" });
  }
});

router.get("/employee-rates", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { memberId } = req.query;
    if (!memberId) return res.status(400).json({ error: "memberId required" });

    const member = await payrollService.findEmployeeInOrg(memberId, req.member.organisation_id);
    if (!member) return res.status(404).json({ error: "Member not found in your organisation" });

    const rate = await payrollService.findEmployeeRate(memberId);
    res.json(rate || {});
  } catch (err) {
    console.error("GET /employee-rates:", err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/employee-rates", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { member_id, hourly_rate, overtime_multiplier, effective_from } = req.body;
    if (!member_id || !hourly_rate || !effective_from) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const member = await payrollService.findEmployeeInOrg(member_id, req.member.organisation_id);
    if (!member) return res.status(404).json({ error: "Member not found in your organisation" });

    const rate = await payrollService.createEmployeeRate(
      member_id,
      hourly_rate,
      overtime_multiplier || 1.5,
      effective_from
    );
    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "CREATE",
      entityType: "employee_rate",
      entityId: rate.id,
      newValues: rate,
      req,
    });
    res.status(201).json(rate);
  } catch (err) {
    console.error("POST /employee-rates:", err);
    res.status(500).json({ error: "Failed to save employee rate" });
  }
});

module.exports = router;
