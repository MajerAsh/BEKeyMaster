-- Drop existing tables in reverse dependency order
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
  solution_code TEXT NOT NULL, -- stringfield array '[40,30,50,20,60]' for pin heights...This makes it easy to compare submitted attempts with stored answers
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Completions table (tracks solved puzzles per user, only 1x/user)
CREATE TABLE completions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id INTEGER REFERENCES puzzles(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, puzzle_id) -- prevent duplicate completions
);

-- remember: ON DELETE CASCADE keeps your DB clean (e.g., delete user → delete their completions).