import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ACTIVE_STATUSES, MFA_REQUIRED_ROLES } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { adminHostAllowed } from "@/lib/admin-host";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll") }).strict(),
  z.object({ action: z.literal("verify"), factorId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).strict(),
]);

/** TOTP enrolment/verification for Admin, Finance and Head of Academics. Requires a password-authenticated (aal1) session. */
export async function POST(req: Request) {
  const limited = await rateLimit("mfa", clientIp(req), 15, "10 m");
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const [user] = await db.select().from(users).where(eq(users.authId, auth.user.id)).limit(1);
  if (!user || user.deletedAt || !ACTIVE_STATUSES.includes(user.status as (typeof ACTIVE_STATUSES)[number]) || !MFA_REQUIRED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }
  if (user.role === "super_admin" && !adminHostAllowed(req)) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  if (parsed.data.action === "enroll") {
    // Drop abandoned (unverified) factors so enrolment can be retried.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const factor of factors?.all ?? []) {
      if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "DLA authenticator" });
    if (error || !data) return NextResponse.json({ error: "Could not start 2FA enrolment" }, { status: 400 });
    return NextResponse.json({ ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: parsed.data.factorId, code: parsed.data.code });
  if (error) return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  return NextResponse.json({ ok: true, redirectTo: roleHome(user.role) });
}
