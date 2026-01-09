ALTER TABLE users
ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);

-- Once ALL existing users backfilled, can enforce NOT NULL.
-- if there are currently zero users with username IS NULL.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM users WHERE username IS NULL) THEN
		ALTER TABLE users ALTER COLUMN username SET NOT NULL;
	END IF;
END $$;