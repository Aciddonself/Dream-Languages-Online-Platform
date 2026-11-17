import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ACTIVE_STATUSES, MFA_REQUIRED_ROLES } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ authenticated: false, issue: "session_missing" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const [user] = await db.select({ role: users.role, status: users.status, deletedAt: users.deletedAt })
    .from(users).where(eq(users.authId, data.user.id)).limit(1);
  if (!user || user.deletedAt || !ACTIVE_STATUSES.includes(user.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json({ authenticated: false, issue: "account_inactive" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  let assuranceLevel: string | null = null;
  if (MFA_REQUIRED_ROLES.includes(user.role)) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    assuranceLevel = assurance?.currentLevel ?? null;
  }

  return NextResponse.json(
    { authenticated: true, role: user.role, assuranceLevel, issue: assuranceLevel === "aal2" || !MFA_REQUIRED_ROLES.includes(user.role) ? null : "mfa_not_verified" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
