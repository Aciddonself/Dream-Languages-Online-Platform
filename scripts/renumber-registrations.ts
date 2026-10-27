/**
 * Renumbers existing registration numbers to the sequential DLA/YYYY/REG/0001 format, oldest first.
 *   npm run reg:renumber            (dry run: prints the plan)
 *   npm run reg:renumber -- --apply (writes the changes)
 * Only students and applicants are renumbered. Numbers already in the sequential format are kept.
 */
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: [".env.local", ".env"], quiet: true });

const apply = process.argv.includes("--apply");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  const pool = new Pool({ connectionString: url.replace(/[?&]sslmode=[^&]*/g, ""), ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('dla-registration-number'))");
    const { rows } = await client.query(
      `select id, registration_number, extract(year from created_at)::int as year
       from users where role in ('student','applicant') order by created_at asc, id asc`,
    );
    const counters = new Map<number, number>();
    const plan: { id: string; from: string | null; to: string }[] = [];
    for (const row of rows) {
      const next = (counters.get(row.year) ?? 0) + 1;
      counters.set(row.year, next);
      plan.push({ id: row.id, from: row.registration_number, to: `DLA/${row.year}/REG/${String(next).padStart(4, "0")}` });
    }
    for (const item of plan) console.log(`${item.from ?? "(none)"}  ->  ${item.to}`);
    if (!apply) {
      await client.query("rollback");
      console.log(`\nDry run: ${plan.length} user(s). Re-run with --apply to write.`);
      return;
    }
    // Two passes so the unique constraint never collides mid-update.
    for (const item of plan) await client.query("update users set registration_number = $1 where id = $2", [`TMP/${item.id}`, item.id]);
    for (const item of plan) await client.query("update users set registration_number = $1 where id = $2", [item.to, item.id]);
    await client.query("commit");
    console.log(`\nRenumbered ${plan.length} user(s).`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
