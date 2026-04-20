const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { action, entity_type, member_id, start, end, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [req.member.organisation_id];
    let where = "WHERE al.organisation_id = $1";

    if (action) {
      params.push(action);
      where += ` AND al.action = $${params.length}`;
    }
    if (entity_type) {
      params.push(entity_type);
      where += ` AND al.entity_type = $${params.length}`;
    }
    if (member_id) {
      params.push(member_id);
      where += ` AND al.member_id = $${params.length}`;
    }
    if (start) {
      params.push(new Date(start));
      where += ` AND al.created_at >= $${params.length}`;
    }
    if (end) {
      params.push(new Date(end));
      where += ` AND al.created_at <= $${params.length}`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM audit_logs al ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT al.*, m.name as member_name, m.avatar_url as member_avatar
       FROM audit_logs al
       LEFT JOIN members m ON al.member_id = m.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      logs: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

module.exports = router;