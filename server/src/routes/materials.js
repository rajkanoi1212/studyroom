const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(16).toString("hex");
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") return cb(new Error("Only PDF files are allowed"));
    cb(null, true);
  },
});

function isMember(groupId, userId) {
  return !!db.prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?").get(groupId, userId);
}

router.post("/", (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!isMember(groupId, req.userId)) return res.status(403).json({ error: "not a member of this group" });

  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "no file uploaded (field name must be 'file')" });

    const result = db
      .prepare(
        `INSERT INTO materials (group_id, uploaded_by, filename, original_name, size_bytes)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(groupId, req.userId, req.file.filename, req.file.originalname, req.file.size);

    res.status(201).json(toMaterialDto(db.prepare("SELECT * FROM materials WHERE id = ?").get(result.lastInsertRowid)));
  });
});

router.get("/", (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!isMember(groupId, req.userId)) return res.status(403).json({ error: "not a member of this group" });

  const rows = db
    .prepare(
      `SELECT m.*, u.name AS uploader_name FROM materials m
       JOIN users u ON u.id = m.uploaded_by
       WHERE m.group_id = ? ORDER BY m.created_at DESC`
    )
    .all(groupId);
  res.json(rows.map(toMaterialDto));
});

router.get("/:materialId/download", (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!isMember(groupId, req.userId)) return res.status(403).json({ error: "not a member of this group" });

  const material = db
    .prepare("SELECT * FROM materials WHERE id = ? AND group_id = ?")
    .get(Number(req.params.materialId), groupId);
  if (!material) return res.status(404).json({ error: "material not found" });

  res.download(path.join(UPLOAD_DIR, material.filename), material.original_name);
});

function toMaterialDto(m) {
  return {
    id: m.id,
    group_id: m.group_id,
    original_name: m.original_name,
    size_bytes: m.size_bytes,
    uploader_name: m.uploader_name,
    created_at: m.created_at,
  };
}

module.exports = router;
