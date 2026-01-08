/**
 * Database connection helper.
 * - Builds a pg Pool from DATABASE_URL
 * - Enables SSL for non-local hosts
 * - Forces IPv4 when possible to avoid IPv6-only environments
 */

const { Pool } = require("pg");
const dns = require("dns").promises;
require("dotenv").config();

/* Local Postgres typically does not support SSL and will return the error if forced */
const connectionString = process.env.DATABASE_URL;
let useSsl = false;

if (connectionString) {
  try {
    const { hostname } = new URL(connectionString);
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    useSsl = !isLocal;
  } catch {
    useSsl = false;
  }
}

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

    // Attempt IPv4 resolution first (some hosts lack IPv6 egress)
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

/* Reusable async-safe query helper. Callers can use db.query(text, params)
 it will wait until the pool is ready.*/
async function query(text, params) {
  const p = await poolReady;
  if (!p) throw new Error("Database pool not configured");
  return p.query(text, params);
}

module.exports = {
  query,
  // expose the poolReady promise for diagnostics/tests
  poolReady,
};
