const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/", requireAuth, async (req, res) => {
  try {
    const { start, end, assigneeId } = req.query;
    let sql = `SELECT s.*, m.name as assignee_name, m.avatar_url as assignee_avatar
               FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id
               WHERE s.organisation_id = $1`;
    const params = [req.member.organisation_id];
    if (start && end) { params.push(new Date(start), new Date(end)); sql += ` AND s.start_time >= $${params.length-1} AND s.start_time <= $${params.length}`; }
    if (assigneeId) { params.push(assigneeId); sql += ` AND s.assignee_id = $${params.length}`; }
    sql += " ORDER BY s.start_time ASC";
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch shifts" }); }
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

router.post("/", requireAuth, requireRole("ADMIN","MANAGER"), async (req, res) => {
  try {
    const { title, startTime, endTime, location, notes, color, assigneeId } = req.body;
    if (assigneeId) {
      const conflict = await query(
        `SELECT id FROM shifts WHERE assignee_id=$1 AND status IN ('ASSIGNED','IN_PROGRESS')
         AND ((start_time<=$2 AND end_time>$2) OR (start_time<$3 AND end_time>=$3) OR (start_time>=$2 AND end_time<=$3))`,
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
    const shift = result.rows[0];
    if (assigneeId) {
      await query(`INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,'SHIFT_ASSIGNED','New Shift Assigned',$2,$3)`,
        [assigneeId, `You have been assigned: ${title}`, JSON.stringify({ shiftId: shift.id })]);
      req.io.to(`user:${assigneeId}`).emit("notification", { type: "SHIFT_ASSIGNED", shift });
    }
    req.io.to(`org:${req.member.organisation_id}`).emit("shift:created", shift);
    res.status(201).json(shift);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to create shift" }); }
});

router.put("/:id", requireAuth, requireRole("ADMIN","MANAGER"), async (req, res) => {
  try {
    const { title, startTime, endTime, location, notes, color, assigneeId, status } = req.body;
    const existing = await query("SELECT * FROM shifts WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });
    const result = await query(
      `UPDATE shifts SET title=COALESCE($1,title), start_time=COALESCE($2,start_time), end_time=COALESCE($3,end_time),
       location=$4, notes=$5, color=COALESCE($6,color), assignee_id=COALESCE($7,assignee_id),
       status=COALESCE($8, CASE WHEN $7 IS NOT NULL THEN 'ASSIGNED' ELSE status END), updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [title, startTime?new Date(startTime):null, endTime?new Date(endTime):null, location, notes, color, assigneeId, status, req.params.id]
    );
    const shift = result.rows[0];
    if (assigneeId && assigneeId !== existing.rows[0].assignee_id) {
      await query(`INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,'SHIFT_ASSIGNED','Shift Assigned',$2,$3)`,
        [assigneeId, `You have been assigned: ${shift.title}`, JSON.stringify({ shiftId: shift.id })]);
      req.io.to(`user:${assigneeId}`).emit("notification", { type: "SHIFT_ASSIGNED", shift });
    }
    req.io.to(`org:${req.member.organisation_id}`).emit("shift:updated", shift);
    res.json(shift);
  } catch (err) { res.status(500).json({ error: "Failed to update" }); }
});

router.delete("/:id", requireAuth, requireRole("ADMIN","MANAGER"), async (req, res) => {
  try {
    const existing = await query("SELECT * FROM shifts WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });
    const shift = existing.rows[0];
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

router.post("/:id/swap", requireAuth, async (req, res) => {
  try {
    const { reason, targetId } = req.body;
    const shift = await query("SELECT * FROM shifts WHERE id=$1 AND assignee_id=$2", [req.params.id, req.member.id]);
    if (!shift.rows.length) return res.status(404).json({ error: "Shift not found or not yours" });
    const result = await query("INSERT INTO swap_requests (shift_id,requester_id,target_id,reason) VALUES ($1,$2,$3,$4) RETURNING *",
      [req.params.id, req.member.id, targetId||null, reason||null]);
    req.io.to(`org:${req.member.organisation_id}`).emit("swap:requested", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.patch("/:id/swap/:swapId", requireAuth, requireRole("ADMIN","MANAGER"), async (req, res) => {
  try {
    const { status } = req.body;
    const result = await query("UPDATE swap_requests SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *", [status, req.params.swapId]);
    const swap = result.rows[0];
    await query(`INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,$2,$3,$4,$5)`,
      [swap.requester_id, `SWAP_${status}`, `Swap ${status}`, `Your swap request was ${status.toLowerCase()}`, JSON.stringify({ shiftId: swap.shift_id })]);
    req.io.to(`user:${swap.requester_id}`).emit("notification", { type: `SWAP_${status}`, swap });
    res.json(swap);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
