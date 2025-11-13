//DB connection
const { Pool } = require("pg");
require("dotenv").config();

// Create a connection pool using DATABASE_URL from .env
// Enable SSL only when DATABASE_URL points to a remote host (not localhost).
// Local Postgres typically does not support SSL and will return the error
// "The server does not support SSL connections" if ssl is forced.
const connectionString = process.env.DATABASE_URL;
const useSsl = connectionString && !connectionString.includes("localhost");

// Log the resolved DB host (don't print credentials) to help debug network issues
// such as ENETUNREACH when deployed. This prints only the hostname portion.
try {
  if (connectionString) {
    const parsed = new URL(connectionString);
    console.log("DB host resolved to:", parsed.hostname, "useSsl:", useSsl);
  } else {
    console.log("No DATABASE_URL configured");
  }
} catch (err) {
  console.log("Failed to parse DATABASE_URL for host logging");
}

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

// Reusable query helper
module.exports = {
  query: (text, params) => pool.query(text, params),
};

// Export the pool so other files can use db.query()
module.exports = pool;
