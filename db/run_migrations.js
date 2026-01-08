/**
 * Runs SQL migration files in a fixed order.
 * Note: schema changes require explicit ALTER/CREATE statements in migration files.
 */

// Run SQL migration files in order using the existing db helper
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./index");

async function runFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  console.log("Running", filePath);

  try {
    await db.query(sql);
  } catch (err) {
    console.error("\n❌ Failed in file:", filePath);
    console.error("Code:", err.code);
    console.error("Message:", err.message);
    throw err;
  }
}

async function run() {
  try {
    await db.poolReady;
    const base = path.join(__dirname);
    const files = [
      path.join(base, "001_core.sql"),
      path.join(base, "002_scores_badges.sql"),
      path.join(base, "badges.sql"),
    ];

    for (const f of files) {
      if (!fs.existsSync(f)) {
        throw new Error(`Missing required migration file: ${f}`);
      }
      await runFile(f);
    }
    console.log("Migrations complete");
  } catch (err) {
    console.error("Migration error", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
