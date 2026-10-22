// Applies every Drizzle migration to an in-memory Postgres (pglite) with Supabase auth stubs, then logs in as each
// role and checks that forbidden actions fail. Run: node supabase/tests/rls.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('aal', nullif(current_setting('request.jwt.claim.aal', true), '')) $$;
  GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;
`);

const dir = "drizzle";
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  const sql = readFileSync(join(dir, f), "utf8");
  for (const stmt of sql.split("--> statement-breakpoint")) if (stmt.trim()) await db.exec(stmt);
}

const ids = {
  admin: "00000000-0000-0000-0000-0000000000a1", teacher: "00000000-0000-0000-0000-0000000000a2",
  student: "00000000-0000-0000-0000-0000000000a3", student2: "00000000-0000-0000-0000-0000000000a4",
  finance: "00000000-0000-0000-0000-0000000000a5", hoc: "00000000-0000-0000-0000-0000000000a6",
};
const roleOf = { admin: "super_admin", teacher: "teacher", student: "student", student2: "student", finance: "finance", hoc: "head_academics" };
for (const [k, id] of Object.entries(ids)) {
  await db.query(
    "INSERT INTO users (id, auth_id, email, role, status, display_name) VALUES ($1,$1,$2,$3,'active',$4)",
    [id, `${k}@dla.test`, roleOf[k], k],
  );
}

async function as(who, aal, fn) {
  await db.exec("BEGIN");
  try {
    await db.exec(`SET LOCAL ROLE ${who === "anon" ? "anon" : "authenticated"}`);
    if (who !== "anon") {
      await db.exec(`SELECT set_config('request.jwt.claim.sub','${ids[who]}',true), set_config('request.jwt.claim.aal','${aal}',true)`);
    }
    return await fn();
  } finally {
    await db.exec("ROLLBACK");
  }
}
const denied = async (name, who, sql, aal = "aal2") => {
  let ok = false;
  try {
    const r = await as(who, aal, () => db.query(sql));
    ok = (r.affectedRows ?? 0) === 0 && r.rows.length === 0;
  } catch { ok = true; }
  return { name, ok };
};
const allowed = async (name, who, sql, aal = "aal2") => {
  try { await as(who, aal, () => db.query(sql)); return { name, ok: true }; } catch (e) { return { name, ok: false, e: e.message }; }
};

const tables = (await db.query("SELECT tablename t, rowsecurity r FROM pg_tables WHERE schemaname='public'")).rows;
const results = [{ name: `RLS enabled on all ${tables.length} tables`, ok: tables.every((t) => t.r) }];

results.push(
  await denied("student cannot self-promote to super_admin", "student", `UPDATE users SET role='super_admin' WHERE id='${ids.student}'`),
  await denied("student cannot read phone column", "student", `SELECT phone FROM users`),
  await denied("student cannot read another student", "student", `SELECT id FROM users WHERE id='${ids.student2}'`),
  await denied("student cannot delete users", "student", `DELETE FROM users`),
  await denied("teacher cannot delete users", "teacher", `DELETE FROM users`),
  await denied("hoc cannot delete users", "hoc", `DELETE FROM users`),
  await denied("finance cannot delete payments", "finance", `DELETE FROM payments`),
  await denied("finance cannot delete users", "finance", `DELETE FROM users`),
  await denied("teacher cannot read payments", "teacher", `SELECT id FROM payments`),
  await denied("teacher cannot read meet_url", "teacher", `SELECT meet_url FROM timetable_sessions`),
  await denied("student cannot read meet_url", "student", `SELECT meet_url FROM timetable_sessions`),
  await denied("student cannot insert posts directly", "student", `INSERT INTO posts (author_id, body) VALUES ('${ids.student}','x')`),
  await denied("admin cannot update audit_logs", "admin", `UPDATE audit_logs SET action='x'`),
  await denied("admin cannot delete audit_logs", "admin", `DELETE FROM audit_logs`),
  await denied("admin cannot truncate audit_logs", "admin", `TRUNCATE audit_logs`),
  await denied("anon cannot read users", "anon", `SELECT id FROM users`),
  await denied("anon cannot read payments", "anon", `SELECT id FROM payments`),
  await denied("admin without MFA (aal1) has no powers", "admin", `SELECT id FROM payments`, "aal1"),
  await denied("finance without MFA (aal1) has no powers", "finance", `INSERT INTO holds (student_id, reason) VALUES ('${ids.student}','x')`, "aal1"),
  await allowed("student can read own row", "student", `SELECT id, display_name FROM users WHERE id='${ids.student}'`),
  await allowed("anon can read published departments", "anon", `SELECT id FROM departments`),
  await allowed("admin (aal2) can delete a payment", "admin", `DELETE FROM payments`),
);

let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.e ? "  -> " + r.e : ""}`);
  if (!r.ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
