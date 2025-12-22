/* NOTE: run_migrations.js won’t “upgrade” 
existing tables unless you add ALTER TABLE*/

// Run SQL migration files in order using the existing db helper
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./index");

/* NOTE: Do NOT include or run the destructive `schema.local.sql` here —
 that file is for local development only (it drops tables). Use the
 additive migration files in this folder for deployed environments.*/

async function runFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  console.log("Running", filePath);
  await db.query(sql);
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
