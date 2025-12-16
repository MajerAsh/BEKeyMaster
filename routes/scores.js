const express = require("express");
const router = express.Router();
const db = require("../db/index");
const jwt = require("jsonwebtoken");
const { computeScore } = require("../lib/scoreCalc");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.sendStatus(401);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.sendStatus(403);
  }
}

// POST /scores - record a score, award badge if first completion for that game
router.post("/", authenticateToken, async (req, res) => {
  const { game, puzzleId = null } = req.body;
  const elapsedSeconds = Number(req.body.elapsedSeconds) || 1;
  const attempts = Number(req.body.attempts) || 1;
  const playerId = req.user && req.user.id;

  if (!playerId || !game)
    return res.status(400).json({ error: "missing required fields" });
  if (elapsedSeconds < 0 || elapsedSeconds > 60 * 60)
    return res.status(400).json({ error: "invalid elapsedSeconds" });

  const { points, raw, attemptsPenalty, elapsed } = computeScore({
    game,
    elapsedSeconds,
    attempts,
  });

  // Use a client from pool for transaction
  const client = await db.poolReady;
  if (!client) return res.status(500).json({ error: "database unavailable" });

  try {
    await client.query("BEGIN");

    const insertQ = `
      INSERT INTO scores (player_id, game, puzzle_id, points, elapsed_seconds, attempts, details)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
      RETURNING id, created_at
    `;
    const details = { raw, attemptsPenalty };
    const r = await client.query(insertQ, [
      playerId,
      game,
      puzzleId,
      points,
      elapsed,
      attempts,
      JSON.stringify(details),
    ]);

    // Award badge if first completion of that game
    const badgeKey =
      game === "DialLock"
        ? "treat_diallock"
        : game === "PinTumbler"
        ? "treat_pintumbler"
        : null;
    let awardedBadge = null;
    if (badgeKey) {
      const badgeRes = await client.query(
        "SELECT id, badge_key AS key, name, svg_path, bonus_points FROM badges WHERE badge_key=$1",
        [badgeKey]
      );
      if (badgeRes.rowCount) {
        const badge = badgeRes.rows[0];
        const exists = await client.query(
          "SELECT 1 FROM player_badges WHERE player_id=$1 AND badge_id=$2",
          [playerId, badge.id]
        );
        if (exists.rowCount === 0) {
          await client.query(
            "INSERT INTO player_badges (player_id, badge_id) VALUES ($1,$2)",
            [playerId, badge.id]
          );
          // insert bonus points as separate score row
          await client.query(
            `INSERT INTO scores (player_id, game, puzzle_id, points, elapsed_seconds, attempts, details)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
            [
              playerId,
              "badge",
              badge.key,
              badge.bonus_points,
              null,
              0,
              JSON.stringify({ awardedBadge: badge.key }),
            ]
          );
          awardedBadge = {
            id: badge.id,
            key: badge.key,
            name: badge.name,
            svg_path: badge.svg_path,
            bonus_points: badge.bonus_points,
          };
        }
      }
    }

    await client.query("COMMIT");

    // fetch updated totals and badges
    const totals = await db.query(
      "SELECT COALESCE(SUM(points),0)::int AS total_points FROM scores WHERE player_id=$1",
      [playerId]
    );
    const badgeCount = await db.query(
      "SELECT COUNT(*)::int AS num_badges FROM player_badges WHERE player_id=$1",
      [playerId]
    );
    const badges = (
      await db.query(
        "SELECT b.badge_key AS key, b.name, b.svg_path FROM badges b JOIN player_badges pb ON pb.badge_id = b.id WHERE pb.player_id = $1",
        [playerId]
      )
    ).rows;

    res.json({
      scoreId: r.rows[0].id,
      points,
      awardedBadge,
      totals: totals.rows[0],
      num_badges: badgeCount.rows[0].num_badges,
      badges,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("Error saving score:", err);
    res.status(500).json({ error: "failed to save score" });
  }
});

// GET /scores/leaderboard - returns leaderboard prioritized by badges, then points, then best time
router.get("/leaderboard", async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const q = `
    SELECT
      u.id AS player_id,
      COALESCE(u.email, '') AS username,
      COALESCE(bc.badge_count, 0) AS puzzles_completed,
      COALESCE(SUM(s.points), 0) AS total_points,
      MIN(s.elapsed_seconds) AS best_time,
      COALESCE(json_agg(DISTINCT b.badge_key) FILTER (WHERE b.badge_key IS NOT NULL), '[]') AS badges
    FROM users u
    LEFT JOIN scores s ON s.player_id = u.id
    LEFT JOIN (
      SELECT player_id, COUNT(*) AS badge_count
      FROM player_badges pb JOIN badges b ON b.id = pb.badge_id
      GROUP BY player_id
    ) bc ON bc.player_id = u.id
    LEFT JOIN player_badges pb2 ON pb2.player_id = u.id
    LEFT JOIN badges b ON b.id = pb2.badge_id
    GROUP BY u.id, u.email, bc.badge_count
    ORDER BY puzzles_completed DESC, total_points DESC, best_time ASC
    LIMIT $1
  `;

  try {
    const { rows } = await db.query(q, [limit]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({ error: "failed to fetch leaderboard" });
  }
});

module.exports = router;
const express = require("express");
const router = express.Router();
const db = require("../db/index");
const jwt = require("jsonwebtoken");
const { computeScore } = require("../lib/scoreCalc");

function authenticate(req) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer (.+)$/i);
  if (!m) return null;
  try {
    const payload = jwt.verify(m[1], process.env.JWT_SECRET);
    return payload; // { id, email }
  } catch (err) {
    return null;
  }
}

// POST /scores
// body: { game, puzzleId, elapsedSeconds, attempts }
router.post("/", async (req, res) => {
  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { game, puzzleId = null } = req.body;
  const elapsedSeconds = Number(req.body.elapsedSeconds) || 1;
  const attempts = Number(req.body.attempts) || 1;

  try {
    const { points, raw, attemptsPenalty, elapsed } = computeScore({
      game,
      elapsedSeconds,
      attempts,
    });

    // insert score row
    const insert = await db.query(
      `INSERT INTO scores (player_id, game, puzzle_id, points, elapsed_seconds, attempts, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        user.id,
        game,
        puzzleId,
        points,
        elapsed,
        attempts,
        { raw, attemptsPenalty },
      ]
    );

    const scoreRow = insert.rows[0];

    // badge awarding mapping
    const badgeKey =
      game === "DialLock"
        ? "treat_diallock"
        : game === "PinTumbler"
        ? "treat_pintumbler"
        : null;
    let awardedBadge = null;

    if (badgeKey) {
      const bq = await db.query(
        `SELECT id, badge_key AS key, name, svg_path, bonus_points FROM badges WHERE badge_key=$1`,
        [badgeKey]
      );
      if (bq.rows.length) {
        const badge = bq.rows[0];
        const exists = await db.query(
          `SELECT 1 FROM player_badges WHERE player_id=$1 AND badge_id=$2`,
          [user.id, badge.id]
        );
        if (exists.rowCount === 0) {
          // award badge
          await db.query(
            `INSERT INTO player_badges (player_id, badge_id) VALUES ($1,$2)`,
            [user.id, badge.id]
          );
          // record bonus as separate scores row
          await db.query(
            `INSERT INTO scores (player_id, game, puzzle_id, points, elapsed_seconds, attempts, details)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              user.id,
              "badge",
              badge.key,
              badge.bonus_points,
              null,
              0,
              { awardedBadge: badge.key },
            ]
          );
          awardedBadge = {
            id: badge.id,
            key: badge.key,
            name: badge.name,
            svg_path: badge.svg_path,
            bonus_points: badge.bonus_points,
          };
        }
      }
    }

    // totals
    const totals = await db.query(
      `SELECT COALESCE(SUM(points),0)::int as total_points FROM scores WHERE player_id=$1`,
      [user.id]
    );
    const badgeCount = await db.query(
      `SELECT COUNT(*)::int AS num_badges FROM player_badges WHERE player_id=$1`,
      [user.id]
    );

    res.json({
      score: scoreRow,
      awardedBadge,
      totals: totals.rows[0],
      num_badges: badgeCount.rows[0].num_badges,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save score" });
  }
});

// GET /scores/leaderboard?limit=20
router.get("/leaderboard", async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  try {
    const q = await db.query(
      `SELECT u.id, u.email AS username, u.avatar_url,
         COALESCE(pb.num_badges,0) AS num_badges,
         COALESCE(s.total_points,0) AS total_points
       FROM users u
       LEFT JOIN (
         SELECT player_id, COUNT(*) as num_badges FROM player_badges GROUP BY player_id
       ) pb ON pb.player_id = u.id
       LEFT JOIN (
         SELECT player_id, SUM(points) as total_points FROM scores GROUP BY player_id
       ) s ON s.player_id = u.id
       ORDER BY num_badges DESC, total_points DESC
       LIMIT $1`,
      [limit]
    );
    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

module.exports = router;
const express = require("express");
const router = express.Router();
const db = require("../db/index");
const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function computePoints({ elapsedSeconds, attempts = 0, maxTime = 120 }) {
  const base = 1000;
  const speedFactor = Math.max(0, Math.min(1, 1 - elapsedSeconds / maxTime));
  const speedPoints = Math.round(base * speedFactor);
  const precisionBonus = Math.max(0, 200 - Math.max(0, attempts - 1) * 50);
  const points = Math.max(0, speedPoints + precisionBonus);
  return { points, speedPoints, precisionBonus };
}

// POST /scores - record a score, award badge if first completion for that game
router.post("/", authenticateToken, async (req, res) => {
  const { game, puzzleId, elapsedSeconds, attempts } = req.body;
  const playerId = req.user && req.user.id;
  if (!playerId || !game || typeof elapsedSeconds !== "number") {
    return res.status(400).json({ error: "missing required fields" });
  }

  // Basic validation
  if (elapsedSeconds < 0 || elapsedSeconds > 60 * 60) {
    return res.status(400).json({ error: "invalid elapsedSeconds" });
  }

  const { points, speedPoints, precisionBonus } = computePoints({
    elapsedSeconds,
    attempts,
  });

  const client = await db.poolReady;
  if (!client) return res.status(500).json({ error: "database unavailable" });

  try {
    await client.query("BEGIN");

    const insertQ = `
      INSERT INTO scores (player_id, game, puzzle_id, points, elapsed_seconds, attempts, details)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
      RETURNING id, created_at
    `;

    const details = { speedPoints, precisionBonus };
    const r = await client.query(insertQ, [
      playerId,
      game,
      puzzleId || null,
      points,
      elapsedSeconds,
      attempts || 0,
      JSON.stringify(details),
    ]);

    // Award badge for first completion of that game
    const badgeKey =
      game === "dial" || game === "diallock"
        ? "badge_diallock"
        : "badge_pintumbler";
    const badgeRes = await client.query(
      "SELECT id, badge_key AS key, name, icon_url FROM badges WHERE badge_key=$1",
      [badgeKey]
    );
    if (badgeRes.rowCount) {
      const badgeId = badgeRes.rows[0].id;
      await client.query(
        `INSERT INTO player_badges (player_id, badge_id) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM player_badges WHERE player_id=$1 AND badge_id=$2)`,
        [playerId, badgeId]
      );
    }

    await client.query("COMMIT");

    // Return player's badges and score summary
    const badges = (
      await client.query(
        `SELECT b.badge_key AS key, b.name, b.icon_url FROM badges b JOIN player_badges pb ON pb.badge_id = b.id WHERE pb.player_id = $1`,
        [playerId]
      )
    ).rows;

    res.json({ scoreId: r.rows[0].id, points, badges });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving score:", err);
    res.status(500).json({ error: "failed to save score" });
  }
});

// GET /scores/leaderboard - returns leaderboard prioritized by puzzles completed (badges), then points, then best time
router.get("/leaderboard", async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  // Aggregation: count badges (unique puzzles completed), sum points, best (min) elapsed_seconds
  const q = `
    SELECT
      u.id AS player_id,
      u.email AS username,
      COALESCE(bc.badge_count, 0) AS puzzles_completed,
      COALESCE(SUM(s.points), 0) AS total_points,
      MIN(s.elapsed_seconds) AS best_time,
      COALESCE(json_agg(DISTINCT b.badge_key) FILTER (WHERE b.badge_key IS NOT NULL), '[]') AS badges
    FROM users u
    LEFT JOIN scores s ON s.player_id = u.id
    LEFT JOIN (
      SELECT player_id, COUNT(DISTINCT b.badge_key) AS badge_count
      FROM player_badges pb JOIN badges b ON b.id = pb.badge_id
      GROUP BY player_id
    ) bc ON bc.player_id = u.id
    LEFT JOIN player_badges pb2 ON pb2.player_id = u.id
    LEFT JOIN badges b ON b.id = pb2.badge_id
    GROUP BY u.id, u.email, bc.badge_count
    ORDER BY puzzles_completed DESC, total_points DESC, best_time ASC
    LIMIT $1
  `;

  try {
    const { rows } = await db.query(q, [limit]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({ error: "failed to fetch leaderboard" });
  }
});

module.exports = router;
