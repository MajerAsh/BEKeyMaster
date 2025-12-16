-- 1) Badges table
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  badge_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  svg_path TEXT,
  bonus_points INTEGER DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2) Scores table
CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL CHECK (game IN ('DialLock', 'PinTumbler')),
  puzzle_id INTEGER REFERENCES puzzles(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  elapsed_seconds INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3) Player badges (user_badges)
CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

-- Helpful indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS scores_user_game_points_idx ON scores(user_id, game, points DESC);
CREATE INDEX IF NOT EXISTS scores_created_at_idx ON scores(created_at DESC);
