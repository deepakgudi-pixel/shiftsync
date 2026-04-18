const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth } = require("../middleware/auth");

router.get("/", requireAuth, async (req, res) => {
  try {
    const { withMemberId } = req.query;
    const result = await query(
      `SELECT msg.*, m.name as sender_name, m.avatar_url as sender_avatar FROM messages msg
       JOIN members m ON msg.sender_id=m.id
       WHERE (msg.sender_id=$1 AND msg.receiver_id=$2) OR (msg.sender_id=$2 AND msg.receiver_id=$1)
       ORDER BY msg.created_at ASC`,
      [req.member.id, withMemberId]
    );
    await query("UPDATE messages SET read=TRUE WHERE receiver_id=$1 AND sender_id=$2 AND read=FALSE", [req.member.id, withMemberId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const result = await query(
      `INSERT INTO messages (sender_id,receiver_id,content) VALUES ($1,$2,$3)
       RETURNING *, (SELECT name FROM members WHERE id=$1) as sender_name`,
      [req.member.id, receiverId, content]
    );
    req.io.to(`user:${receiverId}`).emit("message:new", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
