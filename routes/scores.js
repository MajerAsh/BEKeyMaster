const express = require("express");
const router = express.Router();
const db = require("../db/index");
const { computeScore } = require("../lib/scoreCalc");
const authenticateToken = require("../middleware/authenticateToken");

// POST /scores - record a score, award badge if first score (not necessarily first completion) for that game
router.post("/", authenticateToken, async (req, res) => {
  const { game, puzzleId = null } = req.body;
  const elapsedSeconds = Number(req.body.elapsedSeconds);
  const attempts = Number(req.body.attempts) || 1;
  const playerId = req.user && req.user.id;

  if (!playerId || !game || Number.isNaN(elapsedSeconds))
    return res.status(400).json({ error: "missing required fields" });
  if (elapsedSeconds < 0 || elapsedSeconds > 60 * 60)
    return res.status(400).json({ error: "invalid elapsedSeconds" });

  let points, raw, attemptsPenalty, elapsed;
  try {
    ({ points, raw, attemptsPenalty, elapsed } = computeScore({
      game,
      elapsedSeconds,
      attempts,
    }));
  } catch (err) {
    return res.status(400).json({
      error: err && err.message ? err.message : "invalid score parameters",
    });
  }

  const pool = await db.poolReady;
  if (!pool) return res.status(500).json({ error: "database unavailable" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertQ = `
      INSERT INTO scores (user_id, game, puzzle_id, points, elapsed_seconds, attempts, details)
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

    // Award badge for first score (not necessarily first completion) of that game)
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
          "SELECT 1 FROM user_badges WHERE user_id=$1 AND badge_id=$2",
          [playerId, badge.id]
        );
        if (exists.rowCount === 0) {
          await client.query(
            "INSERT INTO user_badges (user_id, badge_id) VALUES ($1,$2)",
            [playerId, badge.id]
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

    // fetch updated totals and badges (include badge bonus points from badges table)
    const scoreSumRes = await db.query(
      "SELECT COALESCE(SUM(points),0)::int AS score_points, MIN(elapsed_seconds) FILTER (WHERE elapsed_seconds IS NOT NULL) AS best_time, MIN(elapsed_seconds) FILTER (WHERE game = 'DialLock' AND elapsed_seconds IS NOT NULL) AS best_dial_time, MIN(elapsed_seconds) FILTER (WHERE game = 'PinTumbler' AND elapsed_seconds IS NOT NULL) AS best_pin_time FROM scores WHERE user_id=$1",
      [playerId]
    );
    const badgeSumRes = await db.query(
      "SELECT COALESCE(SUM(b.bonus_points),0)::int AS badge_points FROM user_badges pb JOIN badges b ON b.id = pb.badge_id WHERE pb.user_id = $1",
      [playerId]
    );
    const badgeCount = await db.query(
      "SELECT COUNT(*)::int AS num_badges FROM user_badges WHERE user_id=$1",
      [playerId]
    );
    const badges = (
      await db.query(
        "SELECT b.badge_key AS key, b.name, b.svg_path FROM badges b JOIN user_badges pb ON pb.badge_id = b.id WHERE pb.user_id = $1",
        [playerId]
      )
    ).rows;
    const totals = {
      score_points: scoreSumRes.rows[0].score_points,
      badge_points: badgeSumRes.rows[0].badge_points,
      total_points:
        scoreSumRes.rows[0].score_points + badgeSumRes.rows[0].badge_points,
      best_time: scoreSumRes.rows[0].best_time,
      best_dial_time: scoreSumRes.rows[0].best_dial_time,
      best_pin_time: scoreSumRes.rows[0].best_pin_time,
    };

    res.json({
      scoreId: r.rows[0].id,
      points,
      awardedBadge,
      totals: totals,
      num_badges: badgeCount.rows[0].num_badges,
      badges,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("Error saving score:", err);
    return res.status(500).json({ error: "failed to save score" });
  } finally {
    try {
      client.release();
    } catch (_) {}
  }
});

// GET /scores/leaderboard - returns leaderboard prioritized by badges, then points, then best time
router.get("/leaderboard", async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const q = `
    SELECT
      u.id AS user_id,
      COALESCE(u.username, u.email, '') AS username,
      COALESCE(sp.dial_points, 0) AS dial_points,
      COALESCE(sp.pin_points, 0) AS pin_points,
      COALESCE(sp.score_points, 0) AS score_points,
      COALESCE(bc.badge_count, 0) AS puzzles_completed,
      COALESCE(bc.badge_points, 0) AS badge_points,
      (COALESCE(sp.score_points, 0) + COALESCE(bc.badge_points, 0)) AS total_points,
      sp.best_time,
      sp.best_dial_time,
      sp.best_pin_time,
      (COALESCE(sp.dial_points,0) > 0 AND COALESCE(sp.pin_points,0) > 0) AS has_both,
      COALESCE(bc.badges, '[]') AS badges
    FROM users u
    LEFT JOIN (
      SELECT
        user_id,
        COALESCE(SUM(points) FILTER (WHERE game = 'DialLock'), 0) AS dial_points,
        COALESCE(SUM(points) FILTER (WHERE game = 'PinTumbler'), 0) AS pin_points,
        COALESCE(SUM(points),0) AS score_points,
        MIN(elapsed_seconds) FILTER (WHERE elapsed_seconds IS NOT NULL) AS best_time,
        MIN(elapsed_seconds) FILTER (WHERE game = 'DialLock' AND elapsed_seconds IS NOT NULL) AS best_dial_time,
        MIN(elapsed_seconds) FILTER (WHERE game = 'PinTumbler' AND elapsed_seconds IS NOT NULL) AS best_pin_time
      FROM scores
      GROUP BY user_id
    ) sp ON sp.user_id = u.id
    LEFT JOIN (
      SELECT pb.user_id,
             COUNT(DISTINCT b.badge_key) AS badge_count,
             COALESCE(SUM(b.bonus_points),0) AS badge_points,
             COALESCE(json_agg(DISTINCT b.badge_key) FILTER (WHERE b.badge_key IS NOT NULL), '[]') AS badges
      FROM user_badges pb JOIN badges b ON b.id = pb.badge_id
      GROUP BY pb.user_id
    ) bc ON bc.user_id = u.id
    ORDER BY puzzles_completed DESC, total_points DESC, sp.best_time ASC
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
