/**
 * Database connection helper.
 * - Builds a pg Pool from DATABASE_URL
 * - Enables SSL for non-local hosts
 * - Forces IPv4 when possible to avoid IPv6-only environments
 */

const { Pool } = require("pg");
const dns = require("dns").promises;
require("dotenv").config();

const connectionString = process.env.DATABASE_URL;

function shouldUseSsl(url) {
  if (!url) return false;

  try {
    const { hostname } = new URL(url);
    return hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

const useSsl = shouldUseSsl(connectionString);

let pool;

const poolReady = (async () => {
  if (!connectionString) {
    console.warn("DATABASE_URL not configured");
    return null;
  }

  const sslBase = useSsl ? { rejectUnauthorized: false } : false;

  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname;

    // Ensure TLS SNI is preserved for hosts that route by servername (like Supabase pooler)
    // When we connect via a resolved IP, Node would otherwise use the IP as SNI.
    const sslWithServername = useSsl
      ? { ...sslBase, servername: hostname }
      : sslBase;

    // Attempt IPv4 resolution first for hosts that have IPv6 disabled
    try {
      const addrs = await dns.lookup(hostname, { all: true });
      const ipv4 = addrs.find((a) => a.family === 4);

      if (ipv4) {
        const poolConfig = {
          host: ipv4.address,
          port: parsed.port ? Number(parsed.port) : 5432,
          user: parsed.username || undefined,
          password: parsed.password || undefined,
          database: parsed.pathname
            ? parsed.pathname.replace(/^\//, "")
            : undefined,
          ssl: sslWithServername,
        };

        pool = new Pool(poolConfig);
        return pool;
      }
    } catch (dnsErr) {
      console.warn(
        "DB DNS lookup failed; using connectionString:",
        dnsErr.message
      );
    }
  } catch {
    console.warn("Invalid DATABASE_URL; using connectionString");
  }

  // Fallback: let pg handle parsing and connection
  pool = new Pool({ connectionString, ssl: sslBase });
  return pool;
})();

// Async-safe query helper
async function query(text, params) {
  const p = await poolReady;
  if (!p) throw new Error("Database pool not initialized");
  return p.query(text, params);
}

module.exports = {
  query,
  poolReady,
};
