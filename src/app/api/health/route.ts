import { pool } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Probe the real Postgres pool directly. The build-time safe DB stub
    // intentionally makes Drizzle calls resolve empty, so db.execute would
    // incorrectly report healthy when DATABASE_URL is missing.
    await pool.query("select 1");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Database health check failed:", error);
    return Response.json({ ok: false, error: "Database unavailable" }, { status: 503 });
  }
}
