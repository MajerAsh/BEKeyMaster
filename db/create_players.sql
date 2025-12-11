-- Create a simple players table required by scores.player_id foreign key
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at timestamptz DEFAULT now()
);

-- Optionally create an index for lookups by username
CREATE INDEX IF NOT EXISTS players_username_idx ON players(username);
