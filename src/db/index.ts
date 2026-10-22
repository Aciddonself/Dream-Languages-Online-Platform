import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

config({ path: [".env.local", ".env"], quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not configured. Copy the Supabase Postgres connection string (pooler, transaction mode) into .env.local. See .env.example.",
  );
}

if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
  throw new Error("DATABASE_URL must be a PostgreSQL connection URL from your Supabase project.");
}

const isLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl);
// TLS is always verified for remote databases. Download the Supabase CA certificate and pass it via DATABASE_CA_CERT if verification fails.
const ssl = isLocalDatabase
  ? false
  : { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n") } : {}) };

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

const existingPool = globalForDb.__arenaNextJsPostgresqlPool;
export const pool = existingPool ?? new Pool({
  connectionString: databaseUrl.replace(/[?&]sslmode=[^&]*/g, ""),
  ssl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

if (!existingPool) {
  pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
