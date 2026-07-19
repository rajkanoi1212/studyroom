const express = require("express");
const db = require("../db");
const { hashPassword, checkPassword, signToken } = require("../auth");

const router = express.Router();

router.post("/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: "email already registered" });

  const passwordHash = hashPassword(password);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run(name.trim(), email.toLowerCase().trim(), passwordHash);

  const user = { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase().trim() };
  res.status(201).json({ user, token: signToken(user.id) });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (!row || !checkPassword(password, row.password_hash)) {
    return res.status(401).json({ error: "invalid email or password" });
  }

  const user = { id: row.id, name: row.name, email: row.email };
  res.json({ user, token: signToken(user.id) });
});

module.exports = router;
