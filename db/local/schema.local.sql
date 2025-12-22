/* LOCAL ONLY
  This file is intentionally destructive and intended for local development only.
  DO NOT run this against production or hosted DBs (Supabase, Heroku, etc.).

  It drops and recreates tables for quick local resets during development.
  Use the additive SQL files in `db/` (migrations like `create_scores_and_badges.sql`) for
  deployed databases.
*/

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS user_badges;
DROP TABLE IF EXISTS scores;
DROP TABLE IF EXISTS badges;
DROP TABLE IF EXISTS completions;
DROP TABLE IF EXISTS puzzles;
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

-- Puzzles table
CREATE TABLE puzzles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  solution_code TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  type TEXT DEFAULT 'pin-tumbler'
);

-- Completions table (tracks solved puzzles per user, only 1x/user)
CREATE TABLE completions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id INTEGER REFERENCES puzzles(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, puzzle_id)
);
