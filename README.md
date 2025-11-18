# KeyPaw — Backend (BEKeyMaster)

This folder contains the Node/Express backend for the KeyPaw project (repo name: Keymaster). It provides the REST API used by the frontend to authenticate users, serve puzzles, and record completions.

This README focuses on backend setup, required environment variables, database seeding, and deployment notes.

## Quick summary

- Server: Express
- DB: PostgreSQL (pg / node-postgres Pool)
- Auth: bcrypt for passwords, jsonwebtoken (JWT) for sessions
- Example routes:
  - `POST /auth/signup` — create account
  - `POST /auth/login` — authenticate and return JWT
  - `GET /puzzles` — list puzzles (protected)
  - `GET /puzzles/:id` — puzzle detail (protected)
  - `POST /puzzles/solve` — submit attempt (protected)

## Environment variables

Create a `.env` in this folder (do not commit) with at least:

```ini
PORT=3001
DATABASE_URL=postgres://user:password@host:5432/dbname
JWT_SECRET=your_jwt_secret_here
CLIENT_ORIGIN=http://localhost:5173  # frontend origin for CORS
```

- `DATABASE_URL` should point to a Postgres instance. For local development this is usually `postgres://user:pass@localhost:5432/dbname`.
- If your DB is remote (Railway, Supabase), the code will enable SSL automatically unless `DATABASE_URL` contains `localhost`.
- `CLIENT_ORIGIN` is used to configure CORS (must match your frontend origin exactly when credentials are used).

## Install & run (development)

```bash
cd BEKeyMaster
npm ci
# dev: use your dev script (nodemon or similar), or run directly
npm run dev
# or
node server.js
```

Health check: the app exposes `/` and `/health` for simple probes.

## Database schema and seeding

- Schema is in `schema.sql` (create tables for `users`, `puzzles`, `completions`).
- Demo data is inserted with `db/seed.js`.

Important: `db/seed.js` currently performs `DELETE FROM puzzles` before inserting demo rows. Running it against a production DB will remove existing puzzles (and could orphan/clear related completions). Use with caution.

To seed (local DB):

```bash
cd BEKeyMaster
node db/seed.js
```

Alternatively, use the SQL editor in your DB provider and run the statements from `schema.sql` or the sample INSERTs in `db/seed.js`.

## Update prompts / data safely

If you only need to change a puzzle prompt or a single field, prefer a direct `UPDATE` instead of re-running the seed script. Example:

```sql
UPDATE puzzles
SET prompt = 'Align all 5 pins to the correct height to unlock the cabinet and get the treat.'
WHERE id = 9;
```

You can run that in psql, Railway SQL editor, or Supabase SQL editor. This preserves existing ids and completions.

## Notes about DB connectivity & IPv6

Some cloud environments may not have IPv6 egress. If you see `ENETUNREACH` errors to an IPv6 address, the project includes logic in `db/index.js` to resolve the DB hostname and prefer an IPv4 address when available. If your DB provider only exposes IPv6, consider asking for an IPv4 endpoint or using a proxy.

## CORS and preflight

- `app.js` configures CORS using `CLIENT_ORIGIN`. Ensure the value matches your frontend origin (e.g. `https://your-site.netlify.app`).
- The server also responds to `OPTIONS` preflight requests with 204 and the appropriate headers. If the browser reports a missing `Access-Control-Allow-Origin` header, verify `CLIENT_ORIGIN` and that the deployed process was restarted after env changes.

## JWT and authentication

- `JWT_SECRET` must be set. If missing, signup/login will fail.
- Tokens are signed with `jwt.sign({ id, email }, JWT_SECRET)` and expected in requests as `Authorization: Bearer <token>`.

## Logging & troubleshooting

- Server logs useful startup info (configured CORS origin, DB host resolved, server port). Watch logs in Railway/host to diagnose issues.
- Common issues:
  - `The server does not support SSL connections` → DATABASE_URL may point to a local Postgres; ensure SSL is disabled for local connections or use `localhost` in the URL.
  - `ENETUNREACH` to IPv6 address → see IPv6 note above.
  - 404 on OPTIONS preflight → check CORS `CLIENT_ORIGIN` and that the server responds to OPTIONS (the code includes a preflight middleware).

## API endpoints (summary)

- Auth routes: `BEKeyMaster/routes/auth.js`

  - POST `/auth/signup` { email, password } → { token, user }
  - POST `/auth/login` { email, password } → { token, user }

- Puzzle routes: `BEKeyMaster/routes/puzzles.js` (require Authorization header)
  - GET `/puzzles` → list puzzles (excludes sensitive fields as implemented)
  - GET `/puzzles/:id` → puzzle detail
  - POST `/puzzles/solve` { puzzle_id, attempt } → { success: true|false }
  - POST `/puzzles` → create puzzle (protected)

## Deploying

- Railway / Render: set env vars (`DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`) in the service settings and deploy. After deploy, check logs to confirm the DB pool initialized and the server started.
- If your DB is hosted remotely and requires SSL, the backend handles that automatically. For local DB testing, keep `localhost` in `DATABASE_URL` to prevent forcing SSL.

## Development tips

- Use `psql` or your DB provider’s query editor to inspect rows quickly:

```sql
SELECT id, name, type, prompt FROM puzzles ORDER BY id;
```

- When debugging login failures check logs for `Missing JWT_SECRET` or DB connection errors.

## License

MIT — see `LICENSE` in this folder.

## Contact / Next steps

If you want me to add:

- a PATCH `/puzzles/:id` route to update prompts from the API (admin-only),
- an admin UI for editing puzzle prompts from the frontend, or
- a migration script and idempotent upsert SQL for seeds — tell me which and I can implement it.
