const { query } = require("../db/client");

const logAudit = async ({ organisationId, memberId, clerkUserId, action, entityType, entityId, oldValues = null, newValues = null, req = null }) => {
  const ipAddress = req?.ip || req?.headers?.["x-forwarded-for"] || null;
  const userAgent = req?.headers?.["user-agent"] || null;
  try {
    await query(
      `INSERT INTO audit_logs (organisation_id, member_id, clerk_user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [organisationId, memberId, clerkUserId, action, entityType, entityId,
       oldValues ? JSON.stringify(oldValues) : null,
       newValues ? JSON.stringify(newValues) : null,
       ipAddress, userAgent]
    );
  } catch (err) {
    console.error("Audit log failed:", err);
  }
};

module.exports = { logAudit };