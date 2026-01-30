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
const NODE_ENV = process.env.NODE_ENV || "development";

/* Establish pool to reduce latency */
async function start() {
  try {
    await db.poolReady;
    console.log("DB pool initialized, starting server");
  } catch (err) {
    console.warn("DB not ready at startup; continuing:", err?.message || err);
  }

  const server = app.listen(PORT, () => {
    console.log(`API listening on port ${PORT} (${NODE_ENV})`);
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received, closing server...");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
