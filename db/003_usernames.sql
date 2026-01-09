ALTER TABLE users
ADD COLUMN IF NOT EXISTS username TEXT;

-- If you already have users, you'll need to backfill before making it NOT NULL.
-- For now, keep it nullable until you update existing rows.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);

-- Once ALL existing users backfilled, can enforce NOT NULL.
-- if there are currently zero users with username IS NULL.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM users WHERE username IS NULL) THEN
		ALTER TABLE users ALTER COLUMN username SET NOT NULL;
	END IF;
END $$;