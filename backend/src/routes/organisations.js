const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await query(`SELECT o.*, COUNT(m.id) as member_count FROM organisations o LEFT JOIN members m ON o.id=m.organisation_id WHERE o.id=$1 GROUP BY o.id`, [req.member.organisation_id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.get("/announcements", requireAuth, async (req, res) => {
  try {
    const result = await query("SELECT * FROM announcements WHERE organisation_id=$1 ORDER BY created_at DESC LIMIT 20", [req.member.organisation_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

router.post("/announcements", requireAuth, requireRole("ADMIN","MANAGER"), async (req, res) => {
  try {
    const { title, content, priority } = req.body;
    const result = await query("INSERT INTO announcements (title,content,priority,organisation_id,author_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [title, content, priority||"NORMAL", req.member.organisation_id, req.member.id]);
    const members = await query("SELECT id FROM members WHERE organisation_id=$1", [req.member.organisation_id]);
    for (const m of members.rows) {
      await query("INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,'ANNOUNCEMENT',$2,$3,$4)",
        [m.id, title, content.substring(0,100), JSON.stringify({ announcementId: result.rows[0].id })]);
    }
    req.io.to(`org:${req.member.organisation_id}`).emit("announcement:new", result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
