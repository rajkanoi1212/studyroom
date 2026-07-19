const fs = require("fs");
const path = require("path");

const TEST_DB = path.join(__dirname, "test.db");
for (const ext of ["", "-wal", "-shm"]) {
  const p = TEST_DB + ext;
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
process.env.DB_PATH = TEST_DB;
process.env.JWT_SECRET = "test-secret";
process.env.UPLOAD_DIR = path.join(__dirname, "test-uploads");
