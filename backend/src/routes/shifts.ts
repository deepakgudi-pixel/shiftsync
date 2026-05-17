const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");
const { emitEvent } = require("../lib/eventEmitter");
const { EVENT_TYPES } = require("../lib/events");
const shiftService = require("../services/shiftService");
const { body, param, validationResult } = require("express-validator");
const { orgRoom, shiftRoom, userRoom } = require("../lib/socketRooms");

router.get("/", requireAuth, async (req, res) => {
  try {
    const shifts = await shiftService.findShifts(
      req.member.organisation_id,
      req.query,
      req.member.role,
      req.member.id
    );
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch shifts" });
  }
});

router.get("/swaps/pending", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const swaps = await shiftService.findPendingSwaps(req.member.organisation_id);
    res.json(swaps);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch swap requests" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const shift = await shiftService.findShiftById(req.params.id, req.member.organisation_id);
    if (!shift) return res.status(404).json({ error: "Not found" });

    const [clockEvents, swapRequests] = await Promise.all([
      shiftService.findClockEventsForShift(req.params.id),
      shiftService.findSwapRequestsForShift(req.params.id),
    ]);

    res.json({ ...shift, clockEvents, swapRequests });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/", requireAuth, requireRole("ADMIN", "MANAGER"), [
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
      if (req.member.role === "MANAGER") {
        const canAssign = await shiftService.validateManagerCanAssign(assigneeId, req.member.id);
        if (!canAssign) {
          return res.status(403).json({ error: "Managers can only assign shifts to employees or themselves" });
        }
      }

      const conflict = await shiftService.findConflictingShifts(assigneeId, startTime, endTime);
      if (conflict.length) return res.status(409).json({ error: "Schedule conflict detected" });
    }

    const inserted = await shiftService.createShift({
      title, startTime, endTime, location, notes, color, assigneeId,
      organisationId: req.member.organisation_id,
    });

    const shift = await shiftService.findShiftWithDetails(inserted.id) || inserted;

    if (assigneeId) {
      await shiftService.createNotification(
        assigneeId, "SHIFT_ASSIGNED", "New Shift Assigned",
        `You have been assigned: ${title}`,
        { shiftId: shift.id }
      );
      req.io.to(userRoom(assigneeId)).emit("notification", { type: "SHIFT_ASSIGNED", shift });
    }
    req.io.to(orgRoom(req.member.organisation_id)).emit("shift:created", shift);
    req.io.to(shiftRoom(shift.id)).emit("shift:created", shift);

    await emitEvent({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType: EVENT_TYPES.SHIFT_CREATED,
      entityType: "shift",
      entityId: shift.id,
      payload: shift,
      req,
    });
    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "CREATE",
      entityType: "shift",
      entityId: shift.id,
      newValues: shift,
      req,
    });

    res.status(201).json(shift);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create shift" });
  }
});

router.put("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), [
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
    const ifMatch = req.headers["if-match"];
    const expectedVersion = ifMatch !== undefined ? Number.parseInt(String(ifMatch), 10) : undefined;

    if (ifMatch !== undefined && Number.isNaN(expectedVersion)) {
      return res.status(400).json({ error: "Invalid If-Match version" });
    }

    const existing = await shiftService.findShiftWithAssigneeRole(req.params.id, req.member.organisation_id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const hasClockIn = await shiftService.findClockInForShift(req.params.id, req.member.id);
    if (hasClockIn) {
      const lockedFields = shiftService.getLockedFields(existing, { startTime, endTime, assigneeId });
      if (lockedFields.length) {
        return res.status(409).json({
          error: "SHIFT_LOCKED_AFTER_CLOCK_IN",
          message: "Shift time and assignee cannot be changed after the first clock-in.",
          lockedFields,
        });
      }
    }

    if (req.member.role === "MANAGER") {
      const canModify = await shiftService.validateManagerCanModify(existing, req.member.id);
      if (!canModify) return res.status(403).json({ error: "Cannot modify non-employee shifts" });

      if (assigneeId) {
        const canAssign = await shiftService.validateManagerCanAssign(assigneeId, req.member.id);
        if (!canAssign) {
          return res.status(403).json({ error: "Managers can only assign to employees or themselves" });
        }
      }
    }

    const assigneeDefined = req.body.assigneeId !== undefined;
    const finalAssigneeId = (assigneeId && assigneeId !== "") ? assigneeId : null;

    if (startTime || endTime || assigneeDefined) {
      const targetAssignee = assigneeDefined ? finalAssigneeId : existing.assignee_id;
      const targetStart = startTime ? new Date(startTime) : existing.start_time;
      const targetEnd = endTime ? new Date(endTime) : existing.end_time;

      if (targetAssignee) {
        const conflict = await shiftService.findConflictingShifts(targetAssignee, targetStart, targetEnd, req.params.id);
        if (conflict.length) return res.status(409).json({ error: "Schedule conflict detected for this employee" });
      }
    }

    const updated = await shiftService.updateShift(req.params.id, req.member.organisation_id, {
      title, startTime, endTime, location, notes, color,
      assigneeDefined, assigneeId: finalAssigneeId, status, expectedVersion,
    });

    if (!updated) {
      if (expectedVersion === undefined) {
        return res.status(404).json({ error: "Shift not found" });
      }

      return res.status(409).json({
        error: "SHIFT_VERSION_CONFLICT",
        message: "This shift changed since you opened it. Refresh and try again.",
      });
    }

    const shift = await shiftService.findShiftWithDetails(updated.id) || updated;

    if (assigneeId && assigneeId !== existing.assignee_id) {
      await shiftService.createNotification(
        assigneeId, "SHIFT_ASSIGNED", "Shift Assigned",
        `You have been assigned: ${shift.title}`,
        { shiftId: shift.id }
      );
      req.io.to(userRoom(assigneeId)).emit("notification", { type: "SHIFT_ASSIGNED", shift });
    }
    req.io.to(orgRoom(req.member.organisation_id)).emit("shift:updated", shift);
    req.io.to(shiftRoom(shift.id)).emit("shift:updated", shift);

    try {
      await emitEvent({
        organisationId: req.member.organisation_id,
        memberId: req.member.id,
        eventType: EVENT_TYPES.SHIFT_UPDATED,
        entityType: "shift",
        entityId: req.params.id,
        payload: { before: existing, after: shift },
        req,
      });
    } catch (e) {
      console.error("emitEvent failed:", e.message);
    }

    try {
      await logAudit({
        organisationId: req.member.organisation_id,
        memberId: req.member.id,
        clerkUserId: req.clerkUserId,
        action: "UPDATE",
        entityType: "shift",
        entityId: req.params.id,
        oldValues: existing,
        newValues: shift,
        req,
      });
    } catch (e) {
      console.error("logAudit failed:", e.message);
    }

    res.json(shift);
  } catch (err) {
    console.error("Update shift error:", err);
    res.status(500).json({ error: "Failed to update shift" });
  }
});

router.delete("/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const existing = await shiftService.findShiftWithAssigneeRole(req.params.id, req.member.organisation_id);
    if (!existing) return res.status(404).json({ error: "Not found" });

    if (req.member.role === "MANAGER") {
      const canModify = await shiftService.validateManagerCanModify(existing, req.member.id);
      if (!canModify) return res.status(403).json({ error: "Cannot delete non-employee shifts" });
    }

    await emitEvent({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType: EVENT_TYPES.SHIFT_DELETED,
      entityType: "shift",
      entityId: req.params.id,
      payload: existing,
      req,
    });
    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "DELETE",
      entityType: "shift",
      entityId: req.params.id,
      oldValues: existing,
      req,
    });

    await shiftService.deleteShift(req.params.id);

    if (existing.assignee_id) {
      await shiftService.createNotification(
        existing.assignee_id, "SHIFT_CANCELLED", "Shift Cancelled",
        `Your shift "${existing.title}" was cancelled`,
        { shiftId: existing.id }
      );
      req.io.to(userRoom(existing.assignee_id)).emit("notification", { type: "SHIFT_CANCELLED", shiftId: existing.id });
    }
    req.io.to(orgRoom(req.member.organisation_id)).emit("shift:deleted", { id: req.params.id });
    req.io.to(shiftRoom(req.params.id)).emit("shift:deleted", { id: req.params.id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
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
    const shift = await shiftService.findShiftById(req.params.id, req.member.organisation_id);
    if (!shift || shift.assignee_id !== req.member.id) {
      return res.status(404).json({ error: "Shift not found or not yours" });
    }

    const swap = await shiftService.createSwapRequest(req.params.id, req.member.id, targetId, reason);
    const details = await shiftService.findSwapRequestWithDetails(swap.id) || swap;

    req.io.to(orgRoom(req.member.organisation_id)).emit("swap:requested", details);
    req.io.to(shiftRoom(req.params.id)).emit("swap:requested", details);
    await emitEvent({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType: EVENT_TYPES.SWAP_REQUESTED,
      entityType: "swap_request",
      entityId: swap.id,
      payload: details,
      req,
    });
    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "REQUEST",
      entityType: "swap_request",
      entityId: swap.id,
      newValues: swap,
      req,
    });

    res.status(201).json(swap);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.patch("/:id/swap/:swapId", requireAuth, requireRole("ADMIN", "MANAGER"), [
  param("id").isUUID(),
  param("swapId").isUUID(),
  body("status").isIn(["APPROVED", "REJECTED"]),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { status } = req.body;

    const swap = await shiftService.findSwapRequestById(req.params.swapId, req.member.organisation_id);
    if (!swap) return res.status(404).json({ error: "Swap request not found" });

    const updated = await shiftService.updateSwapRequestStatus(req.params.swapId, status);

    if (status === "APPROVED") {
      await shiftService.updateShiftAssignee(swap.shift_id, swap.target_id);
      const updatedShift = await shiftService.findShiftAssigneeName(swap.shift_id);
      req.io.to(orgRoom(req.member.organisation_id)).emit("shift:updated", updatedShift);
      req.io.to(shiftRoom(swap.shift_id)).emit("shift:updated", updatedShift);
      await emitEvent({
        organisationId: req.member.organisation_id,
        memberId: req.member.id,
        eventType: EVENT_TYPES.SHIFT_ASSIGNED,
        entityType: "shift",
        entityId: swap.shift_id,
        payload: updatedShift,
        req,
      });
    }

    const eventType = status === "APPROVED" ? EVENT_TYPES.SWAP_APPROVED : EVENT_TYPES.SWAP_REJECTED;
    await emitEvent({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType,
      entityType: "swap_request",
      entityId: updated.id,
      payload: updated,
      req,
    });
    await logAudit({
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      clerkUserId: req.clerkUserId,
      action: "UPDATE",
      entityType: "swap_request",
      entityId: updated.id,
      newValues: updated,
      req,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

module.exports = router;

export {};
