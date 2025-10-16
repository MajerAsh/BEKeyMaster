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
      `SELECT id, name, prompt, solution_code FROM puzzles ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load puzzles" });
  }
});

// GET puzzle by ID
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT id, name, prompt, solution_code FROM puzzles WHERE id = $1`,
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
    console.log("Expected:", correct);

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

router.post("/", authenticateToken, async (req, res) => {
  const { name, prompt, solution_code } = req.body;

  if (!name || !prompt || !solution_code) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await db.query(
      `INSERT INTO puzzles (name, prompt, solution_code)
       VALUES ($1, $2, $3)`,
      [name, prompt, JSON.stringify(solution_code)]
    );

    res
      .status(201)
      .json({ message: "Puzzle created successfully", id: result.rows[0].id });
  } catch (err) {
    console.error("❌ Error creating puzzle:", err);
    res.status(500).json({ error: "Failed to create puzzle" });
  }
});

module.exports = router;
