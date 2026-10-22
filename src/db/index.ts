import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

config({ path: [".env.local", ".env"], quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not configured. Create .env.local in the project root, copy the pooled PostgreSQL URL from Neon into it, then restart the dev server. See .env.example.",
  );
}

if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
  throw new Error(
    "DATABASE_URL must be a PostgreSQL connection URL. Copy the pooled connection string from your Neon project into .env.local.",
  );
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

const existingPool = globalForDb.__arenaNextJsPostgresqlPool;
export const pool = existingPool ?? new Pool({
  connectionString: databaseUrl,
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
