const { query } = require("../db/client");
const { SHIFT_CONFLICT_WINDOW_SQL } = require("../lib/shiftConflicts");

const findShifts = async (orgId, filters, role, memberId) => {
  const { start, end, assigneeId } = filters;
  let sql = `SELECT s.*, m.name as assignee_name, m.avatar_url as assignee_avatar
             FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id
             WHERE s.organisation_id = $1`;
  const params = [orgId];

  if (role === "MANAGER") {
    params.push(memberId);
    sql += ` AND (m.role = 'EMPLOYEE' OR s.assignee_id IS NULL OR s.assignee_id = $${params.length})`;
  }
  if (start && end) {
    params.push(new Date(start), new Date(end));
    sql += ` AND (s.start_time <= $${params.length} AND s.end_time >= $${params.length - 1})`;
  }
  if (assigneeId) {
    params.push(assigneeId);
    sql += ` AND s.assignee_id = $${params.length}`;
  }
  sql += " ORDER BY s.start_time ASC";

  const result = await query(sql, params);
  return result.rows;
};

const findShiftById = async (id, orgId) => {
  const result = await query(
    `SELECT s.*, m.name as assignee_name, m.email as assignee_email, m.avatar_url as assignee_avatar
     FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id
     WHERE s.id=$1 AND s.organisation_id=$2`,
    [id, orgId]
  );
  return result.rows[0] || null;
};

const findShiftWithAssigneeRole = async (id, orgId) => {
  const result = await query(
    `SELECT s.*, m.role as assignee_role
     FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id
     WHERE s.id=$1 AND s.organisation_id=$2`,
    [id, orgId]
  );
  return result.rows[0] || null;
};

const findShiftWithDetails = async (id) => {
  const result = await query(
    `SELECT s.*, m.name as assignee_name, m.avatar_url as assignee_avatar
     FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id
     WHERE s.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findClockEventsForShift = async (shiftId) => {
  const result = await query(
    "SELECT ce.*, m.name as member_name FROM clock_events ce JOIN members m ON ce.member_id=m.id WHERE ce.shift_id=$1 ORDER BY ce.timestamp",
    [shiftId]
  );
  return result.rows;
};

const findSwapRequestsForShift = async (shiftId) => {
  const result = await query(
    "SELECT sr.*, m.name as requester_name FROM swap_requests sr JOIN members m ON sr.requester_id=m.id WHERE sr.shift_id=$1",
    [shiftId]
  );
  return result.rows;
};

const findPendingSwaps = async (orgId) => {
  const result = await query(
    `SELECT sr.*, s.title as shift_title, m.name as requester_name, m2.name as target_name
     FROM swap_requests sr
     JOIN shifts s ON sr.shift_id = s.id
     JOIN members m ON sr.requester_id = m.id
     LEFT JOIN members m2 ON sr.target_id = m2.id
     WHERE s.organisation_id = $1 AND sr.status = 'PENDING'
     ORDER BY sr.created_at DESC`,
    [orgId]
  );
  return result.rows;
};

const findConflictingShifts = async (assigneeId, startTime, endTime, excludeId) => {
  const params = excludeId
    ? [assigneeId, new Date(startTime), new Date(endTime), excludeId]
    : [assigneeId, new Date(startTime), new Date(endTime)];
  const excludeClause = excludeId ? "AND id != $4" : "";
  const result = await query(
    `SELECT id FROM shifts WHERE assignee_id=$1 AND status IN ('ASSIGNED','IN_PROGRESS')
     ${excludeClause}
     AND ${SHIFT_CONFLICT_WINDOW_SQL}`,
    params
  );
  return result.rows;
};

const findMemberRole = async (memberId) => {
  const result = await query("SELECT role FROM members WHERE id=$1", [memberId]);
  return result.rows[0] || null;
};

const findClockInForShift = async (shiftId, memberId) => {
  const result = await query(
    "SELECT id FROM clock_events WHERE shift_id=$1 AND member_id=$2 AND type='CLOCK_IN' LIMIT 1",
    [shiftId, memberId]
  );
  return result.rows[0] || null;
};

const createShift = async (data) => {
  const result = await query(
    `INSERT INTO shifts (title,start_time,end_time,location,notes,color,status,organisation_id,assignee_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      data.title,
      new Date(data.startTime),
      new Date(data.endTime),
      data.location || null,
      data.notes || null,
      data.color || "#4f6eff",
      data.assigneeId ? "ASSIGNED" : "OPEN",
      data.organisationId,
      data.assigneeId || null,
    ]
  );
  return result.rows[0];
};

const updateShift = async (id, orgId, updates) => {
  const setClauses = [];
  const params = [];
  let paramIdx = 1;

  if (updates.title !== undefined) {
    setClauses.push(`title = $${paramIdx++}`);
    params.push(updates.title || null);
  }
  if (updates.startTime) {
    setClauses.push(`start_time = $${paramIdx++}`);
    params.push(new Date(updates.startTime));
  }
  if (updates.endTime) {
    setClauses.push(`end_time = $${paramIdx++}`);
    params.push(new Date(updates.endTime));
  }
  if (updates.location !== undefined) {
    setClauses.push(`location = $${paramIdx++}`);
    params.push(updates.location || null);
  }
  if (updates.notes !== undefined) {
    setClauses.push(`notes = $${paramIdx++}`);
    params.push(updates.notes || null);
  }
  if (updates.color !== undefined) {
    setClauses.push(`color = $${paramIdx++}`);
    params.push(updates.color || null);
  }
  if (updates.assigneeDefined) {
    setClauses.push(`assignee_id = $${paramIdx++}`);
    params.push(updates.assigneeId);
    if (updates.assigneeId) {
      setClauses.push("status = 'ASSIGNED'");
    } else {
      setClauses.push("status = 'OPEN'");
    }
  }
  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIdx++}`);
    params.push(updates.status);
  }

  setClauses.push("version = version + 1");
  setClauses.push("updated_at = NOW()");
  params.push(id);
  params.push(orgId);
  if (updates.expectedVersion !== undefined) {
    params.push(updates.expectedVersion);
  }

  const versionClause = updates.expectedVersion !== undefined
    ? ` AND version = $${paramIdx + 2}`
    : "";

  const result = await query(
    `UPDATE shifts SET ${setClauses.join(", ")} WHERE id = $${paramIdx++} AND organisation_id = $${paramIdx}${versionClause} RETURNING *`,
    params
  );
  return result.rows[0] || null;
};

const deleteShift = async (id) => {
  await query("DELETE FROM shifts WHERE id=$1", [id]);
};

const createSwapRequest = async (shiftId, requesterId, targetId, reason) => {
  const result = await query(
    "INSERT INTO swap_requests (shift_id,requester_id,target_id,reason) VALUES ($1,$2,$3,$4) RETURNING *",
    [shiftId, requesterId, targetId || null, reason || null]
  );
  return result.rows[0];
};

const findSwapRequestById = async (swapId, orgId) => {
  const result = await query(
    `SELECT sr.* FROM swap_requests sr
     JOIN shifts s ON sr.shift_id = s.id
     WHERE sr.id=$1 AND s.organisation_id=$2`,
    [swapId, orgId]
  );
  return result.rows[0] || null;
};

const findSwapRequestWithDetails = async (swapId) => {
  const result = await query(
    `SELECT sr.*, s.title as shift_title, m.name as requester_name, m2.name as target_name
     FROM swap_requests sr
     JOIN shifts s ON sr.shift_id = s.id
     JOIN members m ON sr.requester_id = m.id
     LEFT JOIN members m2 ON sr.target_id = m2.id
     WHERE sr.id = $1`,
    [swapId]
  );
  return result.rows[0] || null;
};

const updateSwapRequestStatus = async (swapId, status) => {
  const result = await query(
    "UPDATE swap_requests SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
    [status, swapId]
  );
  return result.rows[0];
};

const updateShiftAssignee = async (shiftId, assigneeId) => {
  const newStatus = assigneeId ? "ASSIGNED" : "OPEN";
  const result = await query(
    "UPDATE shifts SET assignee_id=$1, status=$2 WHERE id=$3 RETURNING *",
    [assigneeId, newStatus, shiftId]
  );
  return result.rows[0];
};

const findShiftAssigneeName = async (shiftId) => {
  const result = await query(
    "SELECT s.*, m.name as assignee_name FROM shifts s LEFT JOIN members m ON s.assignee_id = m.id WHERE s.id=$1",
    [shiftId]
  );
  return result.rows[0] || null;
};

const createNotification = async (memberId, type, title, body, data) => {
  await query(
    "INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,$2,$3,$4,$5)",
    [memberId, type, title, body, JSON.stringify(data)]
  );
};

const validateManagerCanAssign = async (assigneeId, managerId) => {
  const target = await findMemberRole(assigneeId);
  return target?.role === "EMPLOYEE" || assigneeId === managerId;
};

const validateManagerCanModify = async (existingShift, managerId) => {
  if (!existingShift.assignee_id) return true;
  if (existingShift.assignee_id === managerId) return true;
  if (existingShift.assignee_role === "EMPLOYEE") return true;
  return false;
};

const getLockedFields = (existingShift, updates) => {
  const lockedFields = [];
  if (updates.startTime !== undefined) lockedFields.push("startTime");
  if (updates.endTime !== undefined) lockedFields.push("endTime");
  if (updates.assigneeId !== undefined) lockedFields.push("assigneeId");
  return lockedFields;
};

module.exports = {
  findShifts,
  findShiftById,
  findShiftWithAssigneeRole,
  findShiftWithDetails,
  findClockEventsForShift,
  findSwapRequestsForShift,
  findPendingSwaps,
  findConflictingShifts,
  findMemberRole,
  findClockInForShift,
  createShift,
  updateShift,
  deleteShift,
  createSwapRequest,
  findSwapRequestById,
  findSwapRequestWithDetails,
  updateSwapRequestStatus,
  updateShiftAssignee,
  findShiftAssigneeName,
  createNotification,
  validateManagerCanAssign,
  validateManagerCanModify,
  getLockedFields,
};

export {};
