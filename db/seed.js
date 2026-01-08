/**
 * Seeds baseline puzzles and deterministic demo leaderboard data.
 *
 * Idempotency:
 * - Puzzles: insert if missing by `name` (no updates if the row already exists).
 * - Demo data: re-seeds ONLY demo users (demo1-3@keypaw.dev) by clearing and re-inserting their scores/badges.
 *
 * Note: Renaming a seeded puzzle creates a new row. To support updates, switch to UPSERT + unique(name).
 */

//Seed puzzle data
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedPuzzles() {
  try {
    const puzzles = [
      {
        name: "Pin Tumbler Lock",
        prompt:
          "Align all 5 pins to the correct height to unlock the cabinet and get the treat.",
        type: "pin-tumbler",
        solution_code: JSON.stringify([40, 30, 50, 20, 60]),
      },
      {
        name: "Dial Lock",
        prompt:
          "Follow the tips to find each number of the 3 number combination to unlock the treat.",
        type: "dial",
        solution_code: JSON.stringify([3, 1, 4]),
      },
    ];

    for (const puzzle of puzzles) {
      // Check if a puzzle with the same name already exists. If not, insert it.
      const exists = await pool.query(
        `SELECT id FROM puzzles WHERE name = $1`,
        [puzzle.name]
      );
      if (exists.rowCount === 0) {
        await pool.query(
          `INSERT INTO puzzles (name, prompt, type, solution_code) VALUES ($1, $2, $3, $4)`,
          [puzzle.name, puzzle.prompt, puzzle.type, puzzle.solution_code]
        );
        console.log(`Inserted puzzle: ${puzzle.name}`);
      } else {
        console.log(`Puzzle already exists, skipping: ${puzzle.name}`);
      }
    }

    // --- Demo leaderboard data (3 users + scores + badges) ---
    // This makes it easy to validate leaderboard sorting and UI rendering.
    await pool.query("BEGIN");
    try {
      const demoEmails = [
        "demo1@keypaw.dev",
        "demo2@keypaw.dev",
        "demo3@keypaw.dev",
      ];

      // Upsert demo users and capture IDs
      const userIds = {};
      for (const email of demoEmails) {
        const r = await pool.query(
          `INSERT INTO users (email, password_hash)
           VALUES ($1, 'not-a-real-hash')
           ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
           RETURNING id`,
          [email]
        );
        userIds[email] = r.rows[0].id;
      }

      // Resolve puzzle IDs by name (safer than assuming IDs)
      const pinPuzzle = await pool.query(
        "SELECT id FROM puzzles WHERE name = $1",
        ["Pin Tumbler Lock"]
      );
      const dialPuzzle = await pool.query(
        "SELECT id FROM puzzles WHERE name = $1",
        ["Dial Lock"]
      );
      const pinPuzzleId = pinPuzzle.rowCount ? pinPuzzle.rows[0].id : null;
      const dialPuzzleId = dialPuzzle.rowCount ? dialPuzzle.rows[0].id : null;

      // Clear previous demo scores/badges (keeps seed idempotent)
      const demoUserIdList = demoEmails.map((e) => userIds[e]);
      await pool.query(
        "DELETE FROM user_badges WHERE user_id = ANY($1::int[])",
        [demoUserIdList]
      );
      await pool.query("DELETE FROM scores WHERE user_id = ANY($1::int[])", [
        demoUserIdList,
      ]);

      // Insert demo scores
      await pool.query(
        `INSERT INTO scores (user_id, game, puzzle_id, points, elapsed_seconds, attempts, details)
         VALUES
           ($1, 'DialLock',   $4, 640, 43, 2, '{"raw":700,"attemptsPenalty":25}'::jsonb),
           ($1, 'PinTumbler', $5, 820, 16, 1, '{"raw":820,"attemptsPenalty":0}'::jsonb),
           ($2, 'DialLock',   $4, 720, 34, 1, '{"raw":720,"attemptsPenalty":0}'::jsonb),
           ($2, 'PinTumbler', $5, 540, 42, 3, '{"raw":590,"attemptsPenalty":50}'::jsonb),
           ($3, 'PinTumbler', $5, 900,  9, 1, '{"raw":900,"attemptsPenalty":0}'::jsonb)
        `,
        [
          userIds["demo1@keypaw.dev"],
          userIds["demo2@keypaw.dev"],
          userIds["demo3@keypaw.dev"],
          dialPuzzleId,
          pinPuzzleId,
        ]
      );

      // Award demo badges (optional)
      const badgeIds = await pool.query(
        "SELECT id, badge_key FROM badges WHERE badge_key IN ('treat_diallock','treat_pintumbler')"
      );
      const badgeIdByKey = Object.fromEntries(
        badgeIds.rows.map((row) => [row.badge_key, row.id])
      );

      const dialBadgeId = badgeIdByKey["treat_diallock"] ?? null;
      const pinBadgeId = badgeIdByKey["treat_pintumbler"] ?? null;

      const demo1Id = userIds["demo1@keypaw.dev"];
      const demo2Id = userIds["demo2@keypaw.dev"];
      if (dialBadgeId) {
        await pool.query(
          "INSERT INTO user_badges (user_id, badge_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [demo1Id, dialBadgeId]
        );
        await pool.query(
          "INSERT INTO user_badges (user_id, badge_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [demo2Id, dialBadgeId]
        );
      }
      if (pinBadgeId) {
        await pool.query(
          "INSERT INTO user_badges (user_id, badge_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [demo1Id, pinBadgeId]
        );
        await pool.query(
          "INSERT INTO user_badges (user_id, badge_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [demo2Id, pinBadgeId]
        );
      }

      await pool.query("COMMIT");
      console.log("Inserted demo users + scores + badges for leaderboard.");
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("😒 Error seeding demo leaderboard data:", err);
    }

    console.log("🍾 Puzzles seeded successfully.");
  } catch (err) {
    console.error("😒 Error seeding puzzles:", err);
  } finally {
    await pool.end();
  }
}

seedPuzzles();
