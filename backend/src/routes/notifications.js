const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth } = require("../middleware/auth");

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query("SELECT * FROM notifications WHERE member_id=$1 ORDER BY created_at DESC LIMIT 50", [req.member.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.patch("/read-all", requireAuth, async (req, res) => {
  try {
    await query("UPDATE notifications SET read=TRUE WHERE member_id=$1", [req.member.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    await query("UPDATE notifications SET read=TRUE WHERE id=$1 AND member_id=$2", [req.params.id, req.member.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
