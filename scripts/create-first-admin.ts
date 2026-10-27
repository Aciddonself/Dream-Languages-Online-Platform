/**
 * One-time first administrator bootstrap.
 *   FIRST_ADMIN_EMAIL=... FIRST_ADMIN_PASSWORD=... npx tsx scripts/create-first-admin.ts
 * Refuses to run if any administrator already exists. The password is read from the environment
 * (never hard-coded) and is not printed. Remove the variable from your shell afterwards.
 * The admin must enrol TOTP 2FA at first sign-in (enforced by the login flow).
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { db, pool } = await import("../src/db");
  const { users } = await import("../src/db/schema");
  const email = process.env.FIRST_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.FIRST_ADMIN_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !password || !url || !key) throw new Error("FIRST_ADMIN_EMAIL, FIRST_ADMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  if (password.length < 10) throw new Error("Password must be at least 10 characters");

  if (!pool) {
    throw new Error("DATABASE_URL is not configured. Add your Supabase Postgres URL to .env.local before creating the first admin.");
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.role, "super_admin")).limit(1);
  if (existing) throw new Error("An administrator already exists. This script only runs once.");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("Could not create the Auth identity");

  await db.insert(users).values({
    email,
    authId: data.user.id,
    role: "super_admin",
    status: "active",
    firstName: "DLA",
    lastName: "Administrator",
    displayName: "DLA Administrator",
  });
  console.log(`First administrator created for ${email}. Sign in and enrol 2FA.`);
  await pool.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed");
  process.exit(1);
});
