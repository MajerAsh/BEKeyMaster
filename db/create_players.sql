-- Create a 'users' table used by authentication and referenced by scores/player_badges.
-- This migration is idempotent and non-destructive.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at timestamptz DEFAULT now()
);

-- Index for quick lookup by email
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
