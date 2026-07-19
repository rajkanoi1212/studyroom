const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

function hashPassword(raw) {
  return bcrypt.hashSync(raw, 10);
}

function checkPassword(raw, hash) {
  return bcrypt.compareSync(raw, hash);
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET); // throws if invalid/expired
}

module.exports = { hashPassword, checkPassword, signToken, verifyToken, JWT_SECRET };
