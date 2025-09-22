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

// GET /puzzles - Get all puzzles (excluding solution)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, prompt FROM puzzles ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load puzzles" });
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
    const match =
      Array.isArray(attempt) &&
      attempt.length === correct.length &&
      attempt.every((val, i) => val === correct[i]);

    if (match) {
      // Save to completions table if not already completed
      await db.query(
        `INSERT INTO completions (user_id, puzzle_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [user_id, puzzle_id]
      );

      return res.json({ success: true });
    } else {
      return res.json({ success: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error solving puzzle" });
  }
});

module.exports = router;
