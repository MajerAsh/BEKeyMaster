// Start server (wait for DB pool to be initialized to avoid first-request latency/ slow unlock)
require("dotenv").config();

const app = require("./app");
const db = require("./db/index");
const PORT = process.env.PORT || 3001;

(async () => {
  try {
    /* Wait for the DB pool to be ready. Reduces latency for the first
   real request which would otherwise block while DNS lookups and pool
    initialization complete.*/
    await db.poolReady;
    console.log("DB pool initialized, starting server");
  } catch (err) {
    console.warn(
      "DB pool initialization failed or timed out:",
      err && err.message ? err.message : err
    );
    /* Proceed to start the server anyway so health checks can run; DB errors
    will show when requests hit database-dependent routes.*/
  }

  app.listen(PORT, () => {
    console.log(`📞 Server listening on port ${PORT}`);
  });
})();
