//DB connection
const { Pool } = require("pg");
require("dotenv").config();

// Create a connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Optional: Log a connection success message
pool
  .connect()
  .then((client) => {
    console.log("✅ Connected to PostgreSQL");
    client.release();
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err.stack);
  });

// Export the pool so other files can use db.query()
module.exports = pool;
