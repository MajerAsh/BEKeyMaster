# KeyPaw — Backend (BEKeyMaster)

Express API for KeyPaw (the backend for the FEKeyMaster frontend). This service provides authentication, puzzle data, and completion tracking backed by PostgreSQL.

Quick highlights

- Server: Express
- DB: PostgreSQL (node-postgres Pool) with IPv4 fallback resolution for cloud robustness
- Auth: bcrypt password hashing and JWT for stateless sessions

API Summary

- `POST /auth/signup` — { email, password } → { token, user }
- `POST /auth/login` — { email, password } → { token, user }
- `GET /puzzles` — list puzzles (Authorization required)
- `GET /puzzles/:id` — puzzle details (Authorization required)
- `POST /puzzles/solve` — submit attempt { puzzle_id, attempt } → { success: boolean }
- `POST /puzzles` — disabled (returns 403)
- `POST /scores` — record a score + (optional) award badge (Authorization required)
- `GET /scores/leaderboard` — leaderboard (no auth)

Environment

Create a `BEKeyMaster/.env` (do not commit) with:

```ini
PORT=3001
DATABASE_URL=postgres://user:password@host:5432/dbname
JWT_SECRET=your_jwt_secret_here
CLIENT_ORIGIN=http://localhost:5173  # frontend origin for CORS
```

- If your DB is remote (Railway, Supabase) the code will enable SSL automatically unless the URL contains `localhost`.
- Changes to `.env` require restarting the server process.

Install & run (development)

```bash
cd BEKeyMaster
npm ci
# Run in dev (nodemon) or directly
npm run dev
# or
node server.js
```

Database & seeding

- This backend uses additive SQL migrations (no destructive drops) in `db/`:
  - `db/001_core.sql` (users, puzzles, completions)
  - `db/002_scores_badges.sql` (scores, badges, user_badges)
  - `db/badges.sql` (badge seed rows)
- Migration runner: `db/run_migrations.js` (runs the files above in order).
  - Note: it primarily uses `CREATE TABLE IF NOT EXISTS` and will not “upgrade” existing tables unless you add `ALTER TABLE` statements.
  - It is not called by `npm start` / `npm run dev`; you run it manually (or via your deploy pipeline).
- Seeding: `db/seed.js`
  - Puzzles are inserted only if missing (by puzzle name).
  - Demo leaderboard seed creates 3 demo users (`demo1/2/3@keypaw.dev`) and inserts demo scores/badges.
  - It keeps re-runs deterministic by deleting ONLY the demo users’ rows in `scores` + `user_badges`.
  - Don’t run it against production unless you actually want those demo accounts/data.

Local reset (destructive)

- `db/local/schema.local.sql` is for local-only full resets (drops tables in FK-safe order). Never run it on hosted databases.

Safe edits

- To update a prompt without reseeding, update by `id` (or by `name`):

```sql
UPDATE puzzles
SET prompt = 'Align all 5 pins to the correct height to unlock the cabinet and get the treat.'
WHERE id = 9;
```

Connectivity notes

- Some cloud environments lack IPv6 egress. The DB helper resolves hostnames and prefers IPv4 A records when available to avoid `ENETUNREACH` on IPv6-only hosts.

CORS & preflight

- `app.js` configures CORS using `CLIENT_ORIGIN`. Ensure that value exactly matches your frontend origin in dev and production.
- The server responds to `OPTIONS` requests with 204 to satisfy preflight checks; if you see a mismatch, confirm `CLIENT_ORIGIN` and restart.

Troubleshooting & logs

- Server logs print configured CORS origin and DB host resolution — check your host or Railway logs for details.
- Common issues:
  - `The server does not support SSL connections`: ensure your `DATABASE_URL` points to a server accepting SSL or use a local `localhost` URL for dev.
  - `ENETUNREACH` to an IPv6 address: see IPv4 fallback note above.
  - 404 on OPTIONS preflight: confirm `CLIENT_ORIGIN` and that the server has been restarted after env changes.

Security & production notes

- Keep `JWT_SECRET` private and rotate regularly for production deployments.
- Use HTTPS in production and set `CLIENT_ORIGIN` to your deployed frontend origin.

Deployment

- Railway / Render: set `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_ORIGIN` in the service settings and deploy. Check startup logs for DB pool initialization.
- Supabase note: merging to GitHub does not automatically apply these SQL migrations to your Supabase database. You must run migrations explicitly (manual run or CI).

Contact & next steps

If you want me to implement additional features I can add:

- PATCH `/puzzles/:id` (admin-only) to edit prompts via API
- An admin UI in the frontend for editing prompts
- A CI job running `npm run type-check` (frontend) and unit tests (if added)

License

MIT — see `LICENSE` in this folder.
