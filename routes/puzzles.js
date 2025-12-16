//Fetch/create puzzles
const express = require("express");
const router = express.Router();
const db = require("../db/index");
const jwt = require("jsonwebtoken");

// Middleware to protect routes
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

// GET /puzzles - Get all puzzles (do NOT return solution_code)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, prompt, type FROM puzzles ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load puzzles" });
  }
});

// GET puzzle by ID (do NOT return solution_code)
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT id, name, prompt, type FROM puzzles WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Puzzle not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching puzzle" });
  }
});

// POST /solve - Submit an answer to a puzzle
router.post("/solve", authenticateToken, async (req, res) => {
  const { puzzle_id, attempt } = req.body;
  const user_id = req.user.id;

  try {
    const result = await db.query(
      `SELECT solution_code FROM puzzles WHERE id = $1`,
      [puzzle_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Puzzle not found" });
    }

    const correct = JSON.parse(result.rows[0].solution_code);

    console.log(`🗝️ User ${user_id} is attempting puzzle ${puzzle_id}`);
    console.log("Attempt:", attempt);

    const match =
      Array.isArray(attempt) &&
      attempt.length === correct.length &&
      attempt.every((val, i) => Math.abs(val - correct[i]) <= 2);

    if (match) {
      // Save to completions table if not already completed
      await db.query(
        `INSERT INTO completions (user_id, puzzle_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [user_id, puzzle_id]
      );

      console.log(`✅ User ${user_id} successfully solved puzzle ${puzzle_id}`);
      return res.json({ success: true });
    } else {
      console.warn(`❌ User ${user_id} failed to solve puzzle ${puzzle_id}`);
      return res.json({ success: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error solving puzzle" });
  }
});

// Puzzle creation via API is disabled to prevent accidental data loss or leaking solutions.
router.post("/", authenticateToken, async (req, res) => {
  return res
    .status(403)
    .json({ error: "Puzzle creation disabled. Manage puzzles via seeds/migrations." });
});

module.exports = router;
