const router = require("express").Router();
const PDFDocument = require("pdfkit");
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");

const CURRENCY_SYMBOLS = {
  USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$",
  INR: "Rs", PHP: "PHP", MXN: "MX$", BRL: "R$"
};
const fmt = (n, symbol) => symbol + (Math.round(n * 100) / 100).toFixed(2);

router.get("/", requireAuth, async (req, res) => {
  try {
    let result;
    if (req.member.role === "EMPLOYEE") {
      result = await query(
        `SELECT p.*, pp.period_type, pp.start_date, pp.end_date, pp.status as period_status, m.name as employee_name
         FROM payslips p
         JOIN pay_periods pp ON p.pay_period_id=pp.id
         JOIN members m ON p.member_id=m.id
         WHERE p.member_id=$1 ORDER BY p.created_at DESC`,
        [req.member.id]
      );
    } else {
      result = await query(
        `SELECT p.*, pp.period_type, pp.start_date, pp.end_date, pp.status as period_status, m.name as employee_name
         FROM payslips p
         JOIN pay_periods pp ON p.pay_period_id=pp.id
         JOIN members m ON p.member_id=m.id
         WHERE p.organisation_id=$1 ORDER BY p.created_at DESC`,
        [req.member.organisation_id]
      );
    }
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, pp.period_type, pp.start_date, pp.end_date, pp.status as period_status,
              m.name as employee_name, m.email, o.name as org_name, o.currency
       FROM payslips p
       JOIN pay_periods pp ON p.pay_period_id=pp.id
       JOIN members m ON p.member_id=m.id
       JOIN organisations o ON p.organisation_id=o.id
       WHERE p.id=$1 AND (p.member_id=$2 OR p.organisation_id=$3)`,
      [req.params.id, req.member.id, req.member.organisation_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Payslip not found" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.get("/:id/pdf", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, pp.period_type, pp.start_date, pp.end_date,
              m.name as employee_name, m.email, o.name as org_name, o.currency
       FROM payslips p
       JOIN pay_periods pp ON p.pay_period_id=pp.id
       JOIN members m ON p.member_id=m.id
       JOIN organisations o ON p.organisation_id=o.id
       WHERE p.id=$1 AND (p.member_id=$2 OR p.organisation_id=$3)`,
      [req.params.id, req.member.id, req.member.organisation_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Payslip not found" });

    const ps = result.rows[0];
    const sym = CURRENCY_SYMBOLS[ps.currency] || "$";

    // Mark as downloaded
    await query("UPDATE payslips SET status='DOWNLOADED' WHERE id=$1", [req.params.id]);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="payslip-${ps.id.slice(0,8)}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor("#1a1a1a").text(ps.org_name, { align: "center" });
    doc.fontSize(12).fillColor("#666").text("PAYSLIP", { align: "center" });
    doc.moveDown();

    // Period info box
    doc.rect(50, doc.y, 500, 50).fill("#f5f5f5");
    doc.fillColor("#1a1a1a");
    const startStr = new Date(ps.start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const endStr = new Date(ps.end_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    doc.fontSize(11).text(`${startStr} — ${endStr}`, 60, doc.y + 8, { align: "center" });
    doc.fontSize(10).fillColor("#666").text(ps.period_type, { align: "center" });

    doc.moveDown(4);

    // Employee info
    doc.fillColor("#1a1a1a").fontSize(12).text("Employee", 50);
    doc.fontSize(11).text(ps.employee_name);
    doc.fontSize(10).fillColor("#666").text(ps.email || "");
    doc.moveDown();

    // Separator
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#e0e0e0").stroke();
    doc.moveDown();

    // Earnings breakdown
    const rowY = doc.y;
    doc.fontSize(11).fillColor("#333");
    doc.text("Description", 50);
    doc.text("Hours", 300, rowY, { width: 80, align: "right" });
    doc.text("Rate", 380, rowY, { width: 70, align: "right" });
    doc.text("Amount", 450, rowY, { width: 100, align: "right" });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#e0e0e0").stroke();
    doc.moveDown(0.5);

    // Base pay row
    doc.fillColor("#333");
    doc.text("Regular Hours", 50, doc.y);
    doc.text(parseFloat(ps.base_hours).toFixed(2), 300, doc.y - 5, { width: 80, align: "right" });
    const baseRate = ps.base_hours > 0 ? (parseFloat(ps.base_earnings) / parseFloat(ps.base_hours)) : 0;
    doc.text(fmt(baseRate, sym), 380, doc.y - 5, { width: 70, align: "right" });
    doc.text(fmt(ps.base_earnings, sym), 450, doc.y - 5, { width: 100, align: "right" });
    doc.moveDown();

    // OT row
    if (parseFloat(ps.overtime_hours) > 0) {
      doc.text("Overtime Hours", 50, doc.y);
      doc.text(parseFloat(ps.overtime_hours).toFixed(2), 300, doc.y - 5, { width: 80, align: "right" });
      doc.text(`${ps.overtime_rate}x`, 380, doc.y - 5, { width: 70, align: "right" });
      doc.text(fmt(ps.overtime_earnings, sym), 450, doc.y - 5, { width: 100, align: "right" });
      doc.moveDown();
    }

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#e0e0e0").stroke();
    doc.moveDown(0.5);

    // Total
    doc.fontSize(13).fillColor("#1a1a1a").text("Total Earnings", 50, doc.y);
    doc.fontSize(13).fillColor("#16a34a").text(fmt(ps.total_earnings, sym), 450, doc.y - 2, { width: 100, align: "right" });

    doc.moveDown(3);

    // Footer
    doc.fontSize(8).fillColor("#999").text(`Payslip ID: ${ps.id.slice(0, 8).toUpperCase()}  |  Generated: ${new Date(ps.created_at).toLocaleDateString()}`, 50, doc.y, { align: "center" });

    doc.end();
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to generate PDF" }); }
});

module.exports = router;