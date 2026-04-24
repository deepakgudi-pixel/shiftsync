const { query } = require("../db/client");

const emitEvent = async ({
  client = null,
  organisationId,
  memberId = null,
  eventType,
  entityType,
  entityId = null,
  payload = {},
  req = null,
}) => {
  const ipAddress = req?.ip || null;
  const userAgent = req?.headers?.["user-agent"] || null;

  const sql = `
    INSERT INTO events (organisation_id, member_id, event_type, entity_type, entity_id, payload, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  const params = [
    organisationId,
    memberId,
    eventType,
    entityType,
    entityId,
    JSON.stringify(payload),
    ipAddress,
    userAgent,
  ];

  if (client) {
    await client.query(sql, params);
  } else {
    query(sql, params).catch((err) => console.error("Event emit failed:", err));
  }
};

module.exports = { emitEvent };