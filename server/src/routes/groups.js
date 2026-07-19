const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

function generateInviteCode() {
  // 6-character, human-friendly (no ambiguous 0/O/1/I) invite code.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  } while (db.prepare("SELECT 1 FROM groups WHERE invite_code = ?").get(code));
  return code;
}

function isMember(groupId, userId) {
  return !!db.prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?").get(groupId, userId);
}

router.post("/", (req, res) => {
  const { name, subject } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });

  const inviteCode = generateInviteCode();
  const result = db
    .prepare("INSERT INTO groups (name, subject, created_by, invite_code) VALUES (?, ?, ?, ?)")
    .run(name.trim(), (subject || "").trim() || null, req.userId, inviteCode);
  const groupId = result.lastInsertRowid;

  db.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'owner')").run(groupId, req.userId);

  res.status(201).json(getGroupDto(groupId));
});

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT g.* FROM groups g
       JOIN group_members m ON m.group_id = g.id
       WHERE m.user_id = ?
       ORDER BY g.created_at DESC`
    )
    .all(req.userId);
  res.json(rows.map((g) => toGroupDto(g)));
});

router.post("/join", (req, res) => {
  const { invite_code } = req.body || {};
  if (!invite_code) return res.status(400).json({ error: "invite_code is required" });

  const group = db.prepare("SELECT * FROM groups WHERE invite_code = ?").get(invite_code.trim().toUpperCase());
  if (!group) return res.status(404).json({ error: "no group found for that invite code" });

  if (isMember(group.id, req.userId)) return res.status(409).json({ error: "already a member of this group" });

  db.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')").run(group.id, req.userId);
  res.json(getGroupDto(group.id));
});

router.get("/:id/members", (req, res) => {
  const groupId = Number(req.params.id);
  if (!isMember(groupId, req.userId)) return res.status(403).json({ error: "not a member of this group" });

  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, m.role FROM users u
       JOIN group_members m ON m.user_id = u.id
       WHERE m.group_id = ?
       ORDER BY m.joined_at ASC`
    )
    .all(groupId);
  res.json(rows);
});

function toGroupDto(g) {
  const memberCount = db.prepare("SELECT COUNT(*) c FROM group_members WHERE group_id = ?").get(g.id).c;
  return {
    id: g.id,
    name: g.name,
    subject: g.subject,
    invite_code: g.invite_code,
    member_count: memberCount,
  };
}
function getGroupDto(groupId) {
  const g = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  return toGroupDto(g);
}

module.exports = router;
