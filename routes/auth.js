//login/sign up routes in routes
const express = require("express");
const router = express.Router();
const db = require("../db/index");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 10;

function dbErrorResponse(err) {
  const code = err && err.code;

  // undefined_column
  if (code === "42703") {
    return {
      status: 500,
      error:
        "Database schema mismatch (missing column). Run migrations on the production database.",
    };
  }

  // undefined_table
  if (code === "42P01") {
    return {
      status: 500,
      error:
        "Database schema mismatch (missing table). Run migrations on the production database.",
    };
  }

  // unique_violation
  if (code === "23505") {
    return { status: 400, error: "Email or username already exists" };
  }

  // not_null_violation
  if (code === "23502") {
    return { status: 400, error: "Missing required fields" };
  }

  return null;
}

function normalizeUsername(input) {
  return String(input || "")
    .trim()
    .toLowerCase();
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

function normalizeEmail(input) {
  return String(input || "")
    .trim()
    .toLowerCase();
}

// POST /signup
router.post("/signup", async (req, res) => {
  const { email, username, password } = req.body;
  const emailNorm = normalizeEmail(email);
  const usernameNorm = normalizeUsername(username);

  if (!emailNorm || !usernameNorm || !password) {
    return res
      .status(400)
      .json({ error: "Missing email, username, or password" });
  }

  if (!isValidUsername(usernameNorm)) {
    return res.status(400).json({
      error:
        "Invalid username. Use 3–20 characters: lowercase letters, numbers, and underscores only.",
    });
  }

  try {
    // Check if user already exists
    const existing = await db.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [emailNorm, usernameNorm]
    );
    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Email or username already exists" });
    }

    // Hash password
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username`,
      [emailNorm, usernameNorm, hash]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    const mapped = dbErrorResponse(err);
    if (mapped) return res.status(mapped.status).json({ error: mapped.error });
    console.error("Signup failed:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// POST /login
router.post("/login", async (req, res) => {
  // Prefer a single field for UI: { login, password }
  // but accept { email, password } or { username, password } for compatibility.
  const { login, email, username, password } = req.body;
  const loginValue = String(login || email || username || "").trim();
  const loginNorm = loginValue.toLowerCase();

  if (!loginValue || !password) {
    return res.status(400).json({ error: "Missing login and/or password" });
  }

  try {
    const result = await db.query(
      `SELECT * FROM users WHERE lower(email) = $1 OR username = $2`,
      [loginNorm, loginNorm]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    const mapped = dbErrorResponse(err);
    if (mapped) return res.status(mapped.status).json({ error: mapped.error });
    console.error("Login failed:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;
