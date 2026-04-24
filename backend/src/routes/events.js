const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth } = require("../middleware/auth");

// Get events since a given timestamp — used by clients on reconnect to rehydrate state
router.get("/since", requireAuth, async (req, res) => {
  try {
    const { since } = req.query;
    if (!since) return res.status(400).json({ error: "since (ISO timestamp) is required" });

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) return res.status(400).json({ error: "invalid since timestamp" });

    const result = await query(
      `SELECT * FROM events
       WHERE organisation_id = $1 AND created_at > $2
       ORDER BY created_at ASC
       LIMIT 500`,
      [req.member.organisation_id, sinceDate]
    );

    res.json({
      events: result.rows,
      count: result.rows.length,
      hasMore: result.rows.length === 500,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Get events by type for an org
router.get("/types/:eventType", requireAuth, async (req, res) => {
  try {
    const { eventType } = req.params;
    const { limit = 50, before } = req.query;

    let sql = `SELECT * FROM events WHERE organisation_id = $1 AND event_type = $2`;
    const params = [req.member.organisation_id, eventType];

    if (before) {
      params.push(new Date(before));
      sql += ` AND created_at < $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

module.exports = router;