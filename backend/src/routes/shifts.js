const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");
const { emitEvent } = require("../lib/eventEmitter");
const { EVENT_TYPES } = require("../lib/events");
const { SHIFT_CONFLICT_WINDOW_SQL } = require("../lib/shiftConflicts");
const { body, param, validationResult } = require("express-validator");

router.get("/", requireAuth, async (req, res) => {
  try {
    const { start, end, assigneeId } = req.query;
    let sql = `SELECT s.*, m.name as assignee_name, m.avatar_url as assignee_avatar
               FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id
               WHERE s.organisation_id = $1`;
    const params = [req.member.organisation_id];
    if (req.member.role === 'MANAGER') {
      params.push(req.member.id);
      sql += ` AND (m.role = 'EMPLOYEE' OR s.assignee_id IS NULL OR s.assignee_id = $${params.length})`;
    }
    if (start && end) { 
      params.push(new Date(start), new Date(end)); 
      sql += ` AND (s.start_time <= $${params.length} AND s.end_time >= $${params.length-1})`; 
    }
    if (assigneeId) { params.push(assigneeId); sql += ` AND s.assignee_id = $${params.length}`; }
    sql += " ORDER BY s.start_time ASC";
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch shifts" }); }
});

router.get("/swaps/pending", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const result = await query(
      `SELECT sr.*, s.title as shift_title, m.name as requester_name, m2.name as target_name
       FROM swap_requests sr
       JOIN shifts s ON sr.shift_id = s.id
       JOIN members m ON sr.requester_id = m.id
       LEFT JOIN members m2 ON sr.target_id = m2.id
       WHERE s.organisation_id = $1 AND sr.status = 'PENDING'
       ORDER BY sr.created_at DESC`,
      [req.member.organisation_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch swap requests" }); }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const shift = await query(
      `SELECT s.*, m.name as assignee_name, m.email as assignee_email, m.avatar_url as assignee_avatar
       FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id
       WHERE s.id=$1 AND s.organisation_id=$2`,
      [req.params.id, req.member.organisation_id]
    );
    if (!shift.rows.length) return res.status(404).json({ error: "Not found" });
    const [clocks, swaps] = await Promise.all([
      query(`SELECT ce.*, m.name as member_name FROM clock_events ce JOIN members m ON ce.member_id=m.id WHERE ce.shift_id=$1 ORDER BY ce.timestamp`, [req.params.id]),
      query(`SELECT sr.*, m.name as requester_name FROM swap_requests sr JOIN members m ON sr.requester_id=m.id WHERE sr.shift_id=$1`, [req.params.id]),
    ]);
    res.json({ ...shift.rows[0], clockEvents: clocks.rows, swapRequests: swaps.rows });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.post("/", requireAuth, requireRole("ADMIN","MANAGER"), [
  body("title").isString().notEmpty().trim().escape(),
  body("startTime").isISO8601(),
  body("endTime").isISO8601(),
  body("assigneeId").optional().isUUID(),
  body("location").optional().isString().trim(),
  body("notes").optional().isString().trim(),
  body("color").optional().isString().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { title, startTime, endTime, location, notes, color, assigneeId } = req.body;
    if (assigneeId) {
      if (req.member.role === 'MANAGER') {
        const target = await query("SELECT role FROM members WHERE id=$1", [assigneeId]);
        if (target.rows[0]?.role !== 'EMPLOYEE' && assigneeId !== req.member.id) return res.status(403).json({ error: "Managers can only assign shifts to employees or themselves" });
      }

      const conflict = await query(
        `SELECT id FROM shifts WHERE assignee_id=$1 AND status IN ('ASSIGNED','IN_PROGRESS')
         AND ${SHIFT_CONFLICT_WINDOW_SQL}`,
        [assigneeId, new Date(startTime), new Date(endTime)]
      );
      if (conflict.rows.length) return res.status(409).json({ error: "Schedule conflict detected" });
    }
    const result = await query(
      `INSERT INTO shifts (title,start_time,end_time,location,notes,color,status,organisation_id,assignee_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, new Date(startTime), new Date(endTime), location||null, notes||null,
       color||"#4f6eff", assigneeId?"ASSIGNED":"OPEN", req.member.organisation_id, assigneeId||null]
    );

    const inserted = result.rows[0];
    const fullShift = await query(`
      SELECT s.*, m.name as assignee_name, m.avatar_url as assignee_avatar 
      FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id 
      WHERE s.id = $1`, [inserted.id]);
    const shift = fullShift.rows[0];

    if (assigneeId) {
      await query(`INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,'SHIFT_ASSIGNED','New Shift Assigned',$2,$3)`,
        [assigneeId, `You have been assigned: ${title}`, JSON.stringify({ shiftId: shift.id })]);
      req.io.to(`user:${assigneeId}`).emit("notification", { type: "SHIFT_ASSIGNED", shift });
    }
    req.io.to(`org:${req.member.organisation_id}`).emit("shift:created", shift);
    await emitEvent({ organisationId: req.member.organisation_id, memberId: req.member.id, eventType: EVENT_TYPES.SHIFT_CREATED, entityType: "shift", entityId: shift.id, payload: shift, req });
    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "CREATE", entityType: "shift", entityId: shift.id, newValues: shift, req });
    res.status(201).json(shift);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to create shift" }); }
});

router.put("/:id", requireAuth, requireRole("ADMIN","MANAGER"), [
  param("id").isUUID(),
  body("title").optional().isString().trim().escape(),
  body("startTime").optional().isISO8601(),
  body("endTime").optional().isISO8601(),
  body("assigneeId").optional({ nullable: true }).isUUID(),
  body("status").optional().isIn(["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED"]),
  body("location").optional().isString().trim(),
  body("notes").optional().isString().trim(),
  body("color").optional().isString().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { title, startTime, endTime, location, notes, color, assigneeId, status } = req.body;
    const existing = await query(
      `SELECT s.*, m.role as assignee_role 
       FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id 
       WHERE s.id=$1 AND s.organisation_id=$2`, 
      [req.params.id, req.member.organisation_id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });

    // Shift lock after clock-in — reject time or assignee changes once clocked in
    const hasClockIn = await query(
      `SELECT id FROM clock_events WHERE shift_id=$1 AND type='CLOCK_IN' LIMIT 1`,
      [req.params.id]
    );
    if (hasClockIn.rows.length) {
      const lockedFields = [];
      if (startTime !== undefined) lockedFields.push("startTime");
      if (endTime !== undefined) lockedFields.push("endTime");
      if (assigneeId !== undefined) lockedFields.push("assigneeId");
      if (lockedFields.length) {
        return res.status(409).json({
          error: "SHIFT_LOCKED_AFTER_CLOCK_IN",
          message: "Shift time and assignee cannot be changed after the first clock-in.",
          lockedFields,
        });
      }
    }

    if (req.member.role === 'MANAGER') {
      if (existing.rows[0].assignee_id && existing.rows[0].assignee_id !== req.member.id && existing.rows[0].assignee_role !== 'EMPLOYEE') {
        return res.status(403).json({ error: "Cannot modify non-employee shifts" });
      }
      if (assigneeId) {
        const target = await query("SELECT role FROM members WHERE id=$1", [assigneeId]);
        if (target.rows[0]?.role !== 'EMPLOYEE' && assigneeId !== req.member.id) return res.status(403).json({ error: "Managers can only assign to employees or themselves" });
      }
    }

    const assigneeDefined = req.body.assigneeId !== undefined;
    const finalAssigneeId = (assigneeId && assigneeId !== '') ? assigneeId : null;

    // If changing time or assignee, check for conflicts
    if (startTime || endTime || assigneeDefined) {
      const targetAssignee = assigneeDefined ? finalAssigneeId : existing.rows[0].assignee_id;
      const targetStart = startTime ? new Date(startTime) : existing.rows[0].start_time;
      const targetEnd = endTime ? new Date(endTime) : existing.rows[0].end_time;

      if (targetAssignee) {
        const conflict = await query(
          `SELECT id FROM shifts WHERE assignee_id=$1 AND status IN ('ASSIGNED','IN_PROGRESS') AND id != $4
           AND ${SHIFT_CONFLICT_WINDOW_SQL}`,
          [targetAssignee, targetStart, targetEnd, req.params.id]
        );
        if (conflict.rows.length) return res.status(409).json({ error: "Schedule conflict detected for this employee" });
      }
    }

    // Build dynamic UPDATE based on what was provided
    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIdx++}`);
      params.push(title || null);
    }
    if (startTime) {
      updates.push(`start_time = $${paramIdx++}`);
      params.push(new Date(startTime));
    }
    if (endTime) {
      updates.push(`end_time = $${paramIdx++}`);
      params.push(new Date(endTime));
    }
    if (location !== undefined) {
      updates.push(`location = $${paramIdx++}`);
      params.push(location || null);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIdx++}`);
      params.push(notes || null);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramIdx++}`);
      params.push(color || null);
    }
    if (assigneeDefined) {
      updates.push(`assignee_id = $${paramIdx++}`);
      params.push(finalAssigneeId);
      // Auto-update status when assignee changes
      if (finalAssigneeId) {
        updates.push(`status = 'ASSIGNED'`);
      } else {
        updates.push(`status = 'OPEN'`);
      }
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIdx++}`);
      params.push(status);
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);
    params.push(req.member.organisation_id);

    const result = await query(
      `UPDATE shifts SET ${updates.join(', ')} WHERE id = $${paramIdx++} AND organisation_id = $${paramIdx} RETURNING *`,
      params
    );

    if (!result.rows.length) return res.status(404).json({ error: "Shift not found" });

    const updated = result.rows[0];
    let shift;
    try {
      const fullShift = await query(`
        SELECT s.*, m.name as assignee_name, m.avatar_url as assignee_avatar
        FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id
        WHERE s.id = $1`, [updated.id]);
      shift = fullShift.rows[0];
    } catch (e) {
      console.error("Failed to fetch full shift:", e.message);
      shift = updated;
    }
    if (assigneeId && assigneeId !== existing.rows[0].assignee_id) {
      await query(`INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,'SHIFT_ASSIGNED','Shift Assigned',$2,$3)`,
        [assigneeId, `You have been assigned: ${shift.title}`, JSON.stringify({ shiftId: shift.id })]);
      req.io.to(`user:${assigneeId}`).emit("notification", { type: "SHIFT_ASSIGNED", shift });
    }
    req.io.to(`org:${req.member.organisation_id}`).emit("shift:updated", shift);
    try {
      await emitEvent({ organisationId: req.member.organisation_id, memberId: req.member.id, eventType: EVENT_TYPES.SHIFT_UPDATED, entityType: "shift", entityId: req.params.id, payload: { before: existing.rows[0], after: shift }, req });
    } catch (e) { console.error("emitEvent failed:", e.message); }
    try {
      await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "UPDATE", entityType: "shift", entityId: req.params.id, oldValues: existing.rows[0], newValues: shift, req });
    } catch (e) { console.error("logAudit failed:", e.message); }
    res.json(shift);
  } catch (err) {
    console.error("Update shift error:", err);
    res.status(500).json({ error: "Failed to update shift" });
  }
});

router.delete("/:id", requireAuth, requireRole("ADMIN","MANAGER"), async (req, res) => {
  try {
    const existing = await query(
      `SELECT s.*, m.role as assignee_role 
       FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id 
       WHERE s.id=$1 AND s.organisation_id=$2`, 
      [req.params.id, req.member.organisation_id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });

    if (req.member.role === 'MANAGER' && existing.rows[0].assignee_id && existing.rows[0].assignee_id !== req.member.id && existing.rows[0].assignee_role !== 'EMPLOYEE') {
      return res.status(403).json({ error: "Cannot delete non-employee shifts" });
    }

    const shift = existing.rows[0];
    await emitEvent({ organisationId: req.member.organisation_id, memberId: req.member.id, eventType: EVENT_TYPES.SHIFT_DELETED, entityType: "shift", entityId: req.params.id, payload: shift, req });
    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "DELETE", entityType: "shift", entityId: req.params.id, oldValues: shift, req });
    await query("DELETE FROM shifts WHERE id=$1", [req.params.id]);
    if (shift.assignee_id) {
      await query(`INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,'SHIFT_CANCELLED','Shift Cancelled',$2,$3)`,
        [shift.assignee_id, `Your shift "${shift.title}" was cancelled`, JSON.stringify({ shiftId: shift.id })]);
      req.io.to(`user:${shift.assignee_id}`).emit("notification", { type: "SHIFT_CANCELLED", shiftId: shift.id });
    }
    req.io.to(`org:${req.member.organisation_id}`).emit("shift:deleted", { id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete" }); }
});

router.post("/:id/swap", requireAuth, [
  param("id").isUUID(),
  body("reason").optional().isString().trim(),
  body("targetId").optional().isUUID(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { reason, targetId } = req.body;
    const shift = await query("SELECT * FROM shifts WHERE id=$1 AND assignee_id=$2", [req.params.id, req.member.id]);
    if (!shift.rows.length) return res.status(404).json({ error: "Shift not found or not yours" });
    const result = await query("INSERT INTO swap_requests (shift_id,requester_id,target_id,reason) VALUES ($1,$2,$3,$4) RETURNING *",
      [req.params.id, req.member.id, targetId||null, reason||null]);

    const details = await query(
      `SELECT sr.*, s.title as shift_title, m.name as requester_name, m2.name as target_name
       FROM swap_requests sr
       JOIN shifts s ON sr.shift_id = s.id
       JOIN members m ON sr.requester_id = m.id
       LEFT JOIN members m2 ON sr.target_id = m2.id
       WHERE sr.id = $1`, [result.rows[0].id]);

    req.io.to(`org:${req.member.organisation_id}`).emit("swap:requested", details.rows[0]);
    await emitEvent({ organisationId: req.member.organisation_id, memberId: req.member.id, eventType: EVENT_TYPES.SWAP_REQUESTED, entityType: "swap_request", entityId: result.rows[0].id, payload: details.rows[0], req });
    await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "REQUEST", entityType: "swap_request", entityId: result.rows[0].id, newValues: result.rows[0], req });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.patch("/:id/swap/:swapId", requireAuth, requireRole("ADMIN","MANAGER"), [
  param("id").isUUID(),
  param("swapId").isUUID(),
  body("status").isIn(["APPROVED", "REJECTED"]),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { status } = req.body;
    const result = await query("UPDATE swap_requests SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *", [status, req.params.swapId]);
    const swap = result.rows[0];

    if (status === 'APPROVED') {
      await query("UPDATE shifts SET assignee_id=$1, status=$2 WHERE id=$3", 
        [swap.target_id, swap.target_id ? 'ASSIGNED' : 'OPEN', swap.shift_id]);
      
      const updatedShift = await query("SELECT s.*, m.name as assignee_name FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id WHERE s.id=$1", [swap.shift_id]);
      req.io.to(`org:${req.member.organisation_id}`).emit("shift:updated", updatedShift.rows[0]);
      await emitEvent({ organisationId: req.member.organisation_id, memberId: req.member.id, eventType: EVENT_TYPES.SHIFT_ASSIGNED, entityType: "shift", entityId: swap.shift_id, payload: updatedShift.rows[0], req });
    }

    const eventType = status === 'APPROVED' ? EVENT_TYPES.SWAP_APPROVED : EVENT_TYPES.SWAP_REJECTED;
    await emitEvent({ organisationId: req.member.organisation_id, memberId: req.member.id, eventType, entityType: "swap_request", entityId: swap.id, payload: swap, req });
    await logAudit({ 
      organisationId: req.member.organisation_id, 
      memberId: req.member.id, 
      clerkUserId: req.clerkUserId, 
      action: "UPDATE", 
      entityType: "swap_request", 
      entityId: swap.id, 
      newValues: swap, 
      req 
    });
    res.json(swap);
  } catch (err) { 
    res.status(500).json({ error: "Failed" }); 
  }
});

module.exports = router;
