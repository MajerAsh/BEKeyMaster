require("dotenv").config();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const app = require("./app");
const db = require("./db/index");
const PORT = process.env.PORT || 3001;

(async () => {
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
})();
