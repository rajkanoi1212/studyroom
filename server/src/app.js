const express = require("express");
const cors = require("cors");

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/groups", require("./routes/groups"));
  app.use("/api/groups/:groupId/materials", require("./routes/materials"));
  app.use("/api/groups/:groupId/messages", require("./routes/messages"));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}

module.exports = { createApp };
