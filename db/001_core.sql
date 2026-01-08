-- 001_core.sql
-- Core schema for a fresh database (idempotent; no DROP statements).

-- Users 
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- Puzzles 
CREATE TABLE IF NOT EXISTS puzzles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'pin-tumbler',
  solution_code TEXT NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS puzzles_type_idx ON puzzles(type);
CREATE INDEX IF NOT EXISTS puzzles_created_at_idx ON puzzles(created_at DESC);

-- Completions 
CREATE TABLE IF NOT EXISTS completions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id INTEGER NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, puzzle_id)
);

CREATE INDEX IF NOT EXISTS completions_user_id_idx ON completions(user_id);
CREATE INDEX IF NOT EXISTS completions_puzzle_id_idx ON completions(puzzle_id);
