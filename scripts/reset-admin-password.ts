/**
 * Changes the password for an existing active super administrator without deleting accounts.
 *   ADMIN_PASSWORD_RESET_EMAIL=... ADMIN_PASSWORD_RESET_PASSWORD=... npm run admin:password-reset
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { and, eq, isNull } from "drizzle-orm";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const email = process.env.ADMIN_PASSWORD_RESET_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD_RESET_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !password || !url || !key || !process.env.DATABASE_URL) {
    throw new Error("ADMIN_PASSWORD_RESET_EMAIL, ADMIN_PASSWORD_RESET_PASSWORD, Supabase URL and service role key, and DATABASE_URL are required");
  }
  if (password.length < 10) throw new Error("Password must be at least 10 characters");

  const { db, pool } = await import("../src/db");
  const { users } = await import("../src/db/schema");

  try {
    const [admin] = await db
      .select({ authId: users.authId })
      .from(users)
      .where(and(
        eq(users.email, email),
        eq(users.role, "super_admin"),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ))
      .limit(1);
    if (!admin?.authId) throw new Error("No active super administrator with that email was found");

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.auth.admin.updateUserById(admin.authId, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Could not update the administrator password: ${error.message}`);

    console.log("Administrator password updated. Sign in at /admin/login and complete 2FA.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed");
  process.exit(1);
});
