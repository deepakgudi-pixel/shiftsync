const router = require("express").Router();
const { pool } = require("../db/client");
const { query } = require("../db/client");
const { requireAuth } = require("../middleware/auth");
const { emitEvent } = require("../lib/eventEmitter");
const { EVENT_TYPES } = require("../lib/events");
const { encrypt, decrypt } = require("../lib/encryption");

router.get("/", requireAuth, async (req, res) => {
  try {
    const { withMemberId } = req.query;
    if (!withMemberId) return res.json([]);

    const result = await query(
      `SELECT msg.*, m.name as sender_name, m.avatar_url as sender_avatar FROM messages msg
       JOIN members m ON msg.sender_id=m.id
       WHERE (msg.sender_id=$1 AND msg.receiver_id=$2) OR (msg.sender_id=$2 AND msg.receiver_id=$1)
       ORDER BY msg.created_at ASC`,
      [req.member.id, withMemberId]
    );

    // Defensive: only update if table schema supports unread tracking
    try {
      await query("UPDATE messages SET read=TRUE WHERE receiver_id=$1 AND sender_id=$2 AND read=FALSE", [req.member.id, withMemberId]);
    } catch (e) {
      // Silently fail if 'read' column doesn't exist yet
    }

    const decryptedRows = result.rows.map(row => ({ ...row, content: decrypt(row.content) }));
    res.json(decryptedRows);
  } catch (err) { 
    console.error("GET Messages Error:", err);
    res.status(500).json({ error: "Failed to fetch messages" }); 
  }
});

router.post("/", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { receiverId, content } = req.body;
    if (!receiverId || !content) return res.status(400).json({ error: "Missing receiverId or content" });

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO messages (sender_id,receiver_id,content) VALUES ($1,$2,$3)
       RETURNING *, (SELECT name FROM members WHERE id=$1) as sender_name`,
      [req.member.id, receiverId, encrypt(content)]
    );

    const msg = { ...result.rows[0], content }; // Send plain text back to sender
    await client.query("COMMIT");
    
    req.io.to(`user:${receiverId}`).emit("message:new", msg);
    await emitEvent({
      client,
      organisationId: req.member.organisation_id,
      memberId: req.member.id,
      eventType: EVENT_TYPES.MESSAGE_SENT,
      entityType: "message",
      entityId: msg.id,
      payload: msg,
    });
    res.status(201).json(msg);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed" });
  } finally {
    client.release();
  }
});

module.exports = router;