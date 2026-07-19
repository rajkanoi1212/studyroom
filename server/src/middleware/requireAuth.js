const { verifyToken } = require("../auth");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing authorization token" });

  try {
    const payload = verifyToken(token);
    req.userId = Number(payload.sub);
    next();
  } catch (e) {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

module.exports = { requireAuth };
