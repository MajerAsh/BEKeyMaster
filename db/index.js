//DB connection
const { Pool } = require("pg");
const dns = require("dns").promises;
require("dotenv").config();

// Create a connection pool using DATABASE_URL from .env
// Enable SSL only when DATABASE_URL points to a remote host (not localhost).
// Local Postgres typically does not support SSL and will return the error
// "The server does not support SSL connections" if ssl is forced.
const connectionString = process.env.DATABASE_URL;
const useSsl = connectionString && !connectionString.includes("localhost");

// Helper to build a Pool. Some cloud environments don't have IPv6 egress.
// If the DB hostname resolves to only IPv6 addresses, try to prefer an
// IPv4 A record so the container can reach the DB.
let pool;
const poolReady = (async () => {
  if (!connectionString) {
    console.log("No DATABASE_URL configured");
    return null;
  }

  let poolConfig = { ssl: useSsl ? { rejectUnauthorized: false } : false };

  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname;
    console.log("DB host resolved to:", hostname, "useSsl:", useSsl);

    // Try to resolve IPv4 address for the hostname. If found, construct
    // pool config with explicit host/port/user/password/database to force
    // IPv4 TCP connect. Otherwise fall back to passing the connectionString
    // directly to the Pool.
    try {
      const addrs = await dns.lookup(hostname, { all: true });
      const ipv4 = addrs.find((a) => a.family === 4);
      if (ipv4) {
        console.log("Using IPv4 address for DB host:", ipv4.address);
        poolConfig = {
          host: ipv4.address,
          port: parsed.port ? Number(parsed.port) : 5432,
          user: parsed.username || undefined,
          password: parsed.password || undefined,
          database: parsed.pathname
            ? parsed.pathname.replace(/^\//, "")
            : undefined,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
        };
        pool = new Pool(poolConfig);
        return pool;
      }
      console.log(
        "No IPv4 address found for DB host; falling back to connectionString"
      );
    } catch (dnsErr) {
      console.log(
        "DNS lookup failed for DB host (will fall back):",
        dnsErr.message
      );
    }
  } catch (parseErr) {
    console.log(
      "Failed to parse DATABASE_URL; falling back to raw connection string"
    );
  }

  // Fallback: let pg parse and connect using the raw connection string
  pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
  return pool;
})();

// Reusable async-safe query helper. Callers can use db.query(text, params)
// and it will wait until the pool is ready.
async function query(text, params) {
  const p = await poolReady;
  if (!p) throw new Error("Database pool not configured");
  return p.query(text, params);
}

module.exports = {
  query,
  // expose the poolReady promise for any diagnostics/tests
  poolReady,
};
