require("dotenv").config();

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`${name} is not set`);
}

requireEnv("JWT_SECRET");

if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const app = require("./app");
const db = require("./db/index");
const PORT = Number(process.env.PORT) || 3001;

/* Establish pool to reduce latency */
async function start() {
  try {
    await db.poolReady;
    console.log("DB pool initialized, starting server");
  } catch (err) {
    console.warn(
      "DB pool initialization failed or timed out:",
      err && err.message ? err.message : err,
    );
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
