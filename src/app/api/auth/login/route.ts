import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ACTIVE_STATUSES, MFA_REQUIRED_ROLES } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const credentialsSchema = z.object({
  email: z.string().trim().min(1).max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(256),
  turnstileToken: z.string().max(4096).optional(),
}).strict();

const invalid = () => NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });
  }
  const { email, password, turnstileToken } = parsed.data;

  const ip = clientIp(req);
  const byIp = await rateLimit("login-ip", ip, 20, "10 m");
  if (!byIp.ok) return tooManyRequests(byIp.retryAfter);
  // Per-account lockout: repeated failures slow attackers down without revealing which emails exist.
  const byEmail = await rateLimit("login-email", email, 5, "15 m");
  if (!byEmail.ok) return tooManyRequests(byEmail.retryAfter);
  if (!await verifyTurnstile(turnstileToken, ip)) {
    return NextResponse.json({ error: "CAPTCHA verification failed" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return invalid();

  const [user] = await db.select().from(users).where(eq(users.authId, data.user.id)).limit(1);
  if (!user || user.deletedAt || !ACTIVE_STATUSES.includes(user.status as (typeof ACTIVE_STATUSES)[number])) {
    await supabase.auth.signOut({ scope: "local" });
    return invalid();
  }

  if (MFA_REQUIRED_ROLES.includes(user.role)) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp.find((factor) => factor.status === "verified");
    return NextResponse.json({ ok: true, mfa: totp ? "verify" : "enroll", factorId: totp?.id ?? null });
  }

  return NextResponse.json({ ok: true, redirectTo: roleHome(user.role), user: { role: user.role } });
}
