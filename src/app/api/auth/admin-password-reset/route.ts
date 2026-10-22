import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { destroyAllSessions, getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { serverEnv } from "@/lib/env";
import { validateNewPassword } from "@/lib/password-policy";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  action: z.literal("request"),
  identifier: z.string().trim().min(1).max(255).transform((value) => value.toLowerCase()),
});
const completeSchema = z.object({
  action: z.literal("complete"),
  token: z.string().regex(/^[A-Za-z0-9_-]{20,200}$/),
  password: z.string().min(10).max(256),
});
const changeSchema = z.object({
  action: z.literal("change_current"),
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(10).max(256),
});

const GENERIC = "If the login belongs to an administrator and recovery email is configured, a one-time link will be sent.";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("admin-reset", ip, 10, "30 m");
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const action = z.object({ action: z.string() }).safeParse(body);
  if (!action.success) return NextResponse.json({ error: "Invalid password recovery request" }, { status: 400 });

  if (action.data.action === "request") {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter your administrator email" }, { status: 400 });

    const [admin] = await db.select().from(users).where(sql`lower(${users.email}) = ${parsed.data.identifier}`).limit(1);
    if (admin?.role === "super_admin" && admin.authId && !admin.deletedAt && ["active", "registered"].includes(admin.status)) {
      const { data, error } = await createSupabaseAdminClient().auth.admin.generateLink({ type: "recovery", email: admin.email });
      if (error || !data.properties?.hashed_token) {
        console.error("Administrator recovery link could not be generated");
      } else {
        const resetUrl = new URL("/admin/forgot-password", serverEnv().APP_URL);
        resetUrl.searchParams.set("token", data.properties.hashed_token);
        const result = await sendEmail({
          to: admin.email,
          subject: "Reset your DLA administrator password",
          html: `<p>A password reset was requested for your DLA administrator account.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>This link is single-use and expires soon. If you did not request it, ignore this email.</p>`,
          dedupeKey: `admin-password-reset:${admin.id}:${Date.now()}`,
        });
        if (!result.sent) console.error("Administrator password recovery email was not sent");
      }
    }
    return NextResponse.json({ ok: true, message: GENERIC });
  }

  if (action.data.action === "change_current") {
    const parsed = changeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter your current password and a new password of at least 10 characters" }, { status: 400 });
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "super_admin" || !admin.authId) {
      return NextResponse.json({ error: "Administrator sign-in is required" }, { status: 403 });
    }
    const problem = await validateNewPassword(parsed.data.newPassword);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    // Verify the current password with an isolated client so the live session cookies are untouched.
    const env = serverEnv();
    const probe = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: verifyError } = await probe.auth.signInWithPassword({ email: admin.email, password: parsed.data.currentPassword });
    if (verifyError) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

    const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(admin.authId, { password: parsed.data.newPassword });
    if (error) return NextResponse.json({ error: "Could not change the password" }, { status: 400 });
    await db.insert(auditLogs).values({ actorId: admin.id, action: "change_admin_password", entityType: "user", entityId: admin.id, ip });
    await destroyAllSessions();
    return NextResponse.json({ ok: true, message: "Administrator password changed. Sign in again with the new password." });
  }

  if (action.data.action === "complete") {
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Use a password with at least 10 characters and a valid reset link" }, { status: 400 });
    const problem = await validateNewPassword(parsed.data.password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: parsed.data.token });
    if (error || !data.user) return NextResponse.json({ error: "This reset link is invalid or expired. Request a new one." }, { status: 400 });
    const [admin] = await db.select().from(users).where(eq(users.authId, data.user.id)).limit(1);
    if (!admin || admin.role !== "super_admin" || admin.deletedAt) {
      await supabase.auth.signOut({ scope: "global" });
      return NextResponse.json({ error: "This reset link is invalid or expired. Request a new one." }, { status: 400 });
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (updateError) {
      await supabase.auth.signOut({ scope: "global" });
      return NextResponse.json({ error: "Could not set the new password" }, { status: 400 });
    }
    await db.insert(auditLogs).values({ actorId: admin.id, action: "reset_admin_password", entityType: "user", entityId: admin.id, ip });
    await supabase.auth.signOut({ scope: "global" });
    return NextResponse.json({ ok: true, message: "Administrator password updated. Sign in with the new password." });
  }

  return NextResponse.json({ error: "Invalid password recovery request" }, { status: 400 });
}
