import "server-only";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureStudentRegistrationNumber } from "@/lib/registration";

export const ACTIVE_STATUSES = ["active", "registered", "applicant"] as const;
export const MFA_REQUIRED_ROLES = ["super_admin", "finance", "head_academics"];

/**
 * Identity comes from Supabase Auth (getUser re-validates the JWT with the Auth server).
 * The role is read from our own users table, never from client input.
 */
export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  let [user] = await db.select().from(users).where(eq(users.authId, data.user.id)).limit(1);
  if (!user || user.deletedAt || !ACTIVE_STATUSES.includes(user.status as (typeof ACTIVE_STATUSES)[number])) return null;

  if (MFA_REQUIRED_ROLES.includes(user.role)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") return null;
  }

  if (user.role === "student" && !user.registrationNumber) {
    const registrationNumber = await ensureStudentRegistrationNumber(user.id, user.registrationNumber);
    user = { ...user, registrationNumber };
  }
  return { user };
}

export async function getCurrentUser() {
  const s = await getSession();
  return s?.user ?? null;
}

/** Signs out this browser session only. */
export async function destroySession() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
}

/** Logout everywhere: revokes every refresh token of the account. */
export async function destroyAllSessions() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "global" });
}

/** Blocks (or re-enables) sign-in at the Auth server for accounts that are not allowed to log in. */
export async function syncAuthBan(authId: string, status: string) {
  const banned = !ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number]);
  await createSupabaseAdminClient().auth.admin.updateUserById(authId, { ban_duration: banned ? "876000h" : "none" });
}
