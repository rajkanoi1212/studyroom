const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

function isMember(groupId, userId) {
  return !!db.prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?").get(groupId, userId);
}
function dmKeyFor(a, b) {
  return [a, b].sort((x, y) => x - y).join("-");
}

// GET /groups/:groupId/messages?room=group
// GET /groups/:groupId/messages?room=dm&peer=<userId>
router.get("/", (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!isMember(groupId, req.userId)) return res.status(403).json({ error: "not a member of this group" });

  const room = req.query.room === "dm" ? "dm" : "group";
  let rows;
  if (room === "group") {
    rows = db
      .prepare(
        `SELECT msg.*, u.name AS sender_name FROM messages msg
         JOIN users u ON u.id = msg.sender_id
         WHERE msg.group_id = ? AND msg.room_type = 'group'
         ORDER BY msg.created_at ASC`
      )
      .all(groupId);
  } else {
    const peerId = Number(req.query.peer);
    if (!peerId) return res.status(400).json({ error: "peer is required for dm room" });
    if (!isMember(groupId, peerId)) return res.status(404).json({ error: "peer is not a member of this group" });
    const key = dmKeyFor(req.userId, peerId);
    rows = db
      .prepare(
        `SELECT msg.*, u.name AS sender_name FROM messages msg
         JOIN users u ON u.id = msg.sender_id
         WHERE msg.group_id = ? AND msg.room_type = 'dm' AND msg.dm_key = ?
         ORDER BY msg.created_at ASC`
      )
      .all(groupId, key);
  }

  res.json(rows.map((m) => ({
    id: m.id, group_id: m.group_id, room_type: m.room_type,
    sender_id: m.sender_id, sender_name: m.sender_name, body: m.body, created_at: m.created_at,
  })));
});

module.exports = router;
