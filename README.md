# KeyPaw Backend API (BEKeyMaster)

Express + PostgreSQL API for the KeyPaw application (paired with the `FEKeyMaster` frontend). It supports JWT authentication, puzzle retrieval/validation, and a scoring + badges leaderboard.

## Highlights

- **Express API** with modular route structure
- **PostgreSQL** via `pg` Pool (includes IPv4 DNS fallback for cloud environments that lack IPv6 egress)
- **Auth** using bcrypt password hashing + JWT
- **Additive migrations** (safe for hosted databases) + deterministic demo seeding for leaderboard testing

## API

### Auth

- `POST /auth/signup` — `{ email, password }` → `{ token, user }`
- `POST /auth/login` — `{ email, password }` → `{ token, user }`

### Puzzles

- `GET /puzzles` — list puzzles (**Authorization required**)
- `GET /puzzles/:id` — puzzle details (**Authorization required**)
- `POST /puzzles/solve` — submit attempt `{ puzzle_id, attempt }` → `{ success: boolean }` (**Authorization required**)
- `POST /puzzles` — disabled (returns 403)

Note: `solution_code` is currently returned by puzzle GET endpoints to support existing frontend gameplay logic.

### Scores

- `POST /scores` — record a score and optionally award a badge (**Authorization required**)
- `GET /scores/leaderboard` — leaderboard (no auth)

## Configuration

Create `BEKeyMaster/.env` (do not commit):

```ini
PORT=3001
DATABASE_URL=postgres://user:password@host:5432/dbname
JWT_SECRET=your_jwt_secret_here
CLIENT_ORIGIN=http://localhost:5173
```

Notes:

- SSL is enabled automatically for non-local databases (anything not `localhost` / `127.0.0.1`).
- Changes to `.env` require restarting the server.

## Local development

```bash
cd BEKeyMaster
npm ci
npm run dev
```

Scripts:

- `npm run dev` — run with `nodemon`
- `npm start` — run with `node server.js`

## Database migrations

This backend uses additive SQL migrations in `db/`:

- `db/001_core.sql` — `users`, `puzzles`, `completions`
- `db/002_scores_badges.sql` — `scores`, `badges`, `user_badges`
- `db/badges.sql` — badge seed rows

Run migrations manually (or in your deploy pipeline):

```bash
node db/run_migrations.js
```

Important:

- The migration runner is **not** invoked by `npm start` / `npm run dev`.
- The migrations primarily use `CREATE TABLE IF NOT EXISTS` and will not change existing columns unless you add `ALTER TABLE` statements.

## Seeding

Run seed script:

```bash
node db/seed.js
```

What it does:

- Inserts puzzles only if missing (by puzzle `name`).
- Creates demo leaderboard data (3 demo users: `demo1/2/3@keypaw.dev`) with demo scores and badges.
- Keeps re-runs deterministic by deleting **only** the demo users’ rows in `scores` and `user_badges`.

## Local reset (destructive)

For local-only full resets, use `db/local/schema.local.sql`.

Do not run destructive reset SQL against hosted databases.

## Operational notes

### Connectivity

Some cloud environments lack IPv6 egress. The DB helper resolves the DB hostname and prefers IPv4 A records when present to avoid `ENETUNREACH` errors.

### CORS

- CORS is configured via `CLIENT_ORIGIN`.
- Preflight `OPTIONS` requests respond with 204.

## Deployment

- Set `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_ORIGIN` in your hosting provider.
- Supabase note: merging to GitHub does not automatically apply migrations/seeds to your Supabase database—you must run migrations explicitly (manual or CI).

## License

MIT — see `LICENSE`.
