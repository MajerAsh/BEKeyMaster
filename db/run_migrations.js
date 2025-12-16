// Run SQL migration files in order using the existing db helper
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./index");

// NOTE: Do NOT include or run the destructive `schema.local.sql` here —
// that file is for local development only (it drops tables). Use the
// additive migration files in this folder for deployed environments.

async function runFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  console.log("Running", filePath);
  await db.query(sql);
}

async function run() {
  try {
    await db.poolReady;
    const base = path.join(__dirname);
    // Prefer numbered migration files (e.g. 001_*.sql, 002_*.sql). If a
    // newer numbered migration exists we'll use it; otherwise fall back to
    // legacy filenames. This prevents running an older incompatible SQL file.
    const preferredScores = path.join(base, "002_scores_badges.sql");
    const legacyScores = path.join(base, "create_scores_and_badges.sql");
    // We already have a `users` table used by auth; do NOT create a separate
    // `players` table. Exclude `create_players.sql` from the default migration
    // order to avoid duplicate identity systems.
    const files = [
      fs.existsSync(preferredScores) ? preferredScores : legacyScores,
      path.join(base, "badges.sql"),
    ];

    // Warn if both new and legacy files exist, so maintainers are aware.
    if (fs.existsSync(preferredScores) && fs.existsSync(legacyScores)) {
      console.warn(
        "Both 002_scores_badges.sql and create_scores_and_badges.sql exist. Using 002_scores_badges.sql. Consider removing the legacy file to avoid confusion."
      );
    }
    for (const f of files) {
      if (fs.existsSync(f)) {
        await runFile(f);
      } else {
        console.log("Skipping not-found", f);
      }
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
