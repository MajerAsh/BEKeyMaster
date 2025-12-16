/*badges table (id, key, name, svg_path, bonus_points, created_at)
scores table (id, player_id FK -> players(id), game, puzzle_id, points, elapsed_seconds, attempts, details JSONB, created_at)
player_badges (player_id FK, badge_id FK, awarded_at, unique constraint)*/

CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,      -- 'treat_diallock', 'treat_pintumbler'
  name TEXT NOT NULL,
  svg_path TEXT,                 -- e.g. '/images/treat1.svg'
  bonus_points INTEGER DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,            -- 'DialLock'|'PinTumbler'
  puzzle_id TEXT,                -- optional puzzle identifier
  points INTEGER NOT NULL,
  elapsed_seconds INTEGER,
  attempts INTEGER,
  details JSONB DEFAULT '{}'     -- store extra metadata
  ,created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_badges (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE (player_id, badge_id)
);