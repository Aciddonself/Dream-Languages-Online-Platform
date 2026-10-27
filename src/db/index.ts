import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

config({ path: [".env.local", ".env"], quiet: true });

const databaseUrl = process.env.DATABASE_URL;

function createSafeDbProxy<T = unknown>() {
  const fallback = Promise.resolve([] as T[]);
  return new Proxy(
    Object.assign(async () => [] as T[], {
      then: (resolve: (value: T[]) => void, reject?: (reason?: unknown) => void) => fallback.then(resolve, reject),
      catch: (onRejected: (reason?: unknown) => void) => fallback.catch(onRejected),
      finally: (onFinally: () => void) => fallback.finally(onFinally),
    }),
    {
      get(_target, prop) {
        const method = String(prop);
        if (["then", "catch", "finally"].includes(method)) {
          const targetRecord = _target as unknown as Record<string, unknown>;
          return targetRecord[method];
        }
        return () => createSafeDbProxy<T>();
      },
    },
  ) as any;
}

const isDatabaseConfigured = Boolean(databaseUrl && (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")));

if (!databaseUrl) {
  console.warn("DATABASE_URL is not configured; using safe no-op database stub until a real Supabase Postgres connection is added.");
}

if (databaseUrl && !databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
  throw new Error("DATABASE_URL must be a PostgreSQL connection URL from your Supabase project.");
}

const safePool = {
  query: async () => {
    throw new Error("DATABASE_URL is not configured. Populate .env.local with a live Supabase Postgres URL before running database operations.");
  },
  end: async () => undefined,
  on: () => undefined,
} as unknown as Pool;

/** Supabase's public root CA (certs/supabase-ca.crt) so TLS stays strictly verified; DATABASE_CA_CERT overrides it. */
function loadCaCert(): string | undefined {
  if (process.env.DATABASE_CA_CERT) return process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n");
  const file = path.join(process.cwd(), "certs", "supabase-ca.crt");
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

const existingPool = globalForDb.__arenaNextJsPostgresqlPool;
export const pool = isDatabaseConfigured
  ? existingPool ?? new Pool({
      connectionString: databaseUrl!.replace(/[?&]sslmode=[^&]*/g, ""),
      ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl!)
        ? false
        : { rejectUnauthorized: true, ...(loadCaCert() ? { ca: loadCaCert() } : {}) },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : safePool;

if (pool !== safePool && !existingPool) {
  pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
  });
}

if (pool !== safePool && process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = isDatabaseConfigured && pool !== safePool
  ? drizzle(pool)
  : ({
      select: () => createSafeDbProxy(),
      insert: () => createSafeDbProxy(),
      update: () => createSafeDbProxy(),
      delete: () => createSafeDbProxy(),
      execute: async () => ({ rows: [], rowCount: 0 }),
      transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({}),
    } as any);
