//DB connection
const { Pool } = require("pg");
require("dotenv").config();

// Create a connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Reusable query helper
module.exports = {
  query: (text, params) => pool.query(text, params),
};

// Export the pool so other files can use db.query()
module.exports = pool;
