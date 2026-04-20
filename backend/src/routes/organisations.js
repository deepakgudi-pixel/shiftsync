const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAudit } = require("../lib/audit");

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT o.*, COUNT(m.id) as member_count FROM organisations o LEFT JOIN members m ON o.id=m.organisation_id WHERE o.id=$1 GROUP BY o.id`,
      [req.member.organisation_id],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/announcements", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, m.name as target_name 
       FROM announcements a 
       LEFT JOIN members m ON a.target_member_id = m.id 
       WHERE a.organisation_id=$1 
       AND ($2 = 'ADMIN' OR a.target_member_id IS NULL OR a.target_member_id = $3)
       ORDER BY a.created_at DESC LIMIT 20`,
      [req.member.organisation_id, req.member.role, req.member.id],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post(
  "/announcements",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { title, content, priority, targetMemberId } = req.body;
      const result = await query(
        "INSERT INTO announcements (title,content,priority,organisation_id,author_id,target_member_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          title,
          content,
          priority || "NORMAL",
          req.member.organisation_id,
          req.member.id,
          targetMemberId || null,
        ],
      );
      if (targetMemberId) {
        await query(
          "INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,'ANNOUNCEMENT',$2,$3,$4)",
          [
            targetMemberId,
            title,
            content.substring(0, 100),
            JSON.stringify({ announcementId: result.rows[0].id }),
          ],
        );
      } else {
        const members = await query(
          "SELECT id FROM members WHERE organisation_id=$1",
          [req.member.organisation_id],
        );
        for (const m of members.rows) {
          await query(
            "INSERT INTO notifications (member_id,type,title,body,data) VALUES ($1,'ANNOUNCEMENT',$2,$3,$4)",
            [
              m.id,
              title,
              content.substring(0, 100),
              JSON.stringify({ announcementId: result.rows[0].id }),
            ],
          );
        }
      }

      req.io
        .to(`org:${req.member.organisation_id}`)
        .emit("announcement:new", result.rows[0]);
      await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "CREATE", entityType: "announcement", entityId: result.rows[0].id, newValues: result.rows[0], req });
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Failed" });
    }
  },
);

router.delete(
  "/announcements/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const existing = await query("SELECT * FROM announcements WHERE id=$1 AND organisation_id=$2", [req.params.id, req.member.organisation_id]);
      if (!existing.rows.length) return res.status(404).json({ error: "Not found" });
      await logAudit({ organisationId: req.member.organisation_id, memberId: req.member.id, clerkUserId: req.clerkUserId, action: "DELETE", entityType: "announcement", entityId: req.params.id, oldValues: existing.rows[0], req });
      await query(
        "DELETE FROM announcements WHERE id=$1 AND organisation_id=$2",
        [req.params.id, req.member.organisation_id],
      );
      req.io
        .to(`org:${req.member.organisation_id}`)
        .emit("announcement:deleted", { id: req.params.id });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete" });
    }
  },
);

module.exports = router;
