/**
 * Removes the demo accounts and creates the single Super Admin.
 *   npm run admin:reset
 * Optional env: SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD (a strong random password is generated and
 * printed once if not supplied). Requires Supabase + DATABASE_URL in .env.local and applied migrations.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";

config({ path: [".env.local", ".env"], quiet: true });

const DEMO_EMAILS = [
  "admin@dla.ug",
  "hoc@teachers.dla.ug",
  "teacher@teachers.dla.ug",
  "finance@dla.ug",
  "student@students.dla.ug",
  "applicant@dla.ug",
];

function generatePassword() {
  return `${randomBytes(12).toString("base64url")}Aa1!`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL (Supabase Postgres connection string) must be set in .env.local");

  const { db, pool } = await import("../src/db");
  const { users, roles } = await import("../src/db/schema");

  const email = (process.env.SUPER_ADMIN_EMAIL ?? "superadmin@dreamlanguagesug.com").trim().toLowerCase();
  const generated = !process.env.SUPER_ADMIN_PASSWORD;
  const password = process.env.SUPER_ADMIN_PASSWORD ?? generatePassword();
  if (password.length < 10) throw new Error("Password must be at least 10 characters");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  for (const role of [["super_admin", "Super Admin"], ["head_academics", "Head of Academics"], ["teacher", "Teacher"], ["finance", "Finance Officer"], ["student", "Student"], ["applicant", "Applicant"], ["guest", "Guest"]]) {
    await db.insert(roles).values({ key: role[0], name: role[1] }).onConflictDoNothing();
  }

  const demo = await db.select().from(users).where(inArray(users.email, DEMO_EMAILS));
  for (const user of demo) {
    if (user.authId) await supabase.auth.admin.deleteUser(user.authId);
    try {
      await db.delete(users).where(eq(users.id, user.id));
    } catch {
      await db.update(users).set({ status: "suspended", deletedAt: new Date() }).where(eq(users.id, user.id));
    }
  }
  console.log(`Removed ${demo.length} demo user(s).`);

  let authId: string | undefined;
  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.data.user) authId = created.data.user.id;
  else {
    const list = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = list.data?.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) throw new Error(`Could not create the Auth identity: ${created.error?.message}`);
    authId = existing.id;
    await supabase.auth.admin.updateUserById(authId, { password, email_confirm: true });
  }

  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const values = { email, authId, role: "super_admin", status: "active", firstName: "DLA", lastName: "Super Admin", displayName: "DLA Super Admin", deletedAt: null };
  if (row) await db.update(users).set(values).where(eq(users.id, row.id));
  else await db.insert(users).values(values);

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const adminHost = (process.env.ADMIN_HOST ?? "").trim().toLowerCase();
  const adminOrigin = adminHost
    ? `${/^localhost(:\d+)?$/.test(adminHost) ? "http" : "https"}://${adminHost}`
    : appUrl;

  console.log("\nSuper admin ready");
  console.log(`  Login URL : ${adminOrigin}/admin/login`);
  console.log(`  Email     : ${email}`);
  console.log(`  Password  : ${generated ? password : "(the SUPER_ADMIN_PASSWORD you supplied)"}`);
  console.log("First sign-in asks you to scan a QR code with an authenticator app (2FA is mandatory for admins).");
  await pool?.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed");
  process.exit(1);
});
