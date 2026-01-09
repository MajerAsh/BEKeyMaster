ALTER TABLE users
ADD COLUMN IF NOT EXISTS username TEXT;

-- If you already have users, you'll need to backfill before making it NOT NULL.
-- For now, keep it nullable until you update existing rows.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);

-- After backfill, can enforce:
-- ALTER TABLE users ALTER COLUMN username SET NOT NULL;