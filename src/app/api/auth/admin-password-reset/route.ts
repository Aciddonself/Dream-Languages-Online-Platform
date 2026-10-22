import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, sessions, users } from "@/db/schema";
import { createSession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

const requestSchema = z.object({
  action: z.literal("request"),
  identifier: z.string().trim().min(1).max(255).transform((value) => value.toLowerCase()),
});
const completeSchema = z.object({
  action: z.literal("complete"),
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  password: z.string().min(12).max(256),
});
const changeSchema = z.object({
  action: z.literal("change_current"),
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
});

export async function POST(request: Request) {
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
    if (!parsed.success) return NextResponse.json({ error: "Enter your administrator email or login name" }, { status: 400 });

    const [admin] = await db.select().from(users).where(sql`lower(${users.email}) = ${parsed.data.identifier}`).limit(1);
    if (admin?.role === "super_admin" && !admin.deletedAt && ["active", "registered"].includes(admin.status)) {
      const appUrl = process.env.APP_URL;
      if (!appUrl || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) {
        console.error("Administrator password recovery requires a valid administrator email address and APP_URL.");
      } else {
        const origin = new URL(appUrl);
        if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") {
          console.error("Administrator password recovery APP_URL must use HTTPS in production.");
          return NextResponse.json({
            ok: true,
            message: "If the login belongs to an administrator and recovery email is configured, a one-time link will be sent.",
          });
        }
        const resetUrl = new URL("/admin/forgot-password", origin);
        const token = randomBytes(32).toString("hex");
        resetUrl.searchParams.set("token", token);
        await db.insert(sessions).values({
          userId: admin.id,
          token,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          userAgent: "admin-password-reset",
        });
        const result = await sendEmail({
          to: admin.email,
          subject: "Reset your DLA administrator password",
          html: `<p>A password reset was requested for your DLA administrator account.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>This link expires in 30 minutes and can be used once. If you did not request it, ignore this email.</p>`,
          dedupeKey: `admin-password-reset:${admin.id}:${createHash("sha256").update(token).digest("hex")}`,
        });
        if (!result.sent) {
          await db.delete(sessions).where(eq(sessions.token, token));
          console.error("Administrator password recovery email was not sent:", result.error);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "If the login belongs to an administrator and recovery email is configured, a one-time link will be sent.",
    });
  }

  if (action.data.action === "change_current") {
    const parsed = changeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter your current password and a new password of at least 12 characters" }, { status: 400 });
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "super_admin") {
      return NextResponse.json({ error: "Administrator sign-in is required" }, { status: 403 });
    }
    if (!await verifyPassword(parsed.data.currentPassword, admin.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: new Date() }).where(eq(users.id, admin.id));
      await tx.delete(sessions).where(eq(sessions.userId, admin.id));
      await tx.insert(auditLogs).values({
        actorId: admin.id,
        action: "change_admin_password",
        entityType: "user",
        entityId: admin.id,
      });
    });
    await createSession(admin.id);
    return NextResponse.json({ ok: true, message: "Administrator password changed successfully." });
  }

  if (action.data.action === "complete") {
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Use a password with at least 12 characters and a valid reset link" }, { status: 400 });
    const outcome = await db.transaction(async (tx) => {
      const [reset] = await tx.select().from(sessions).where(
        and(eq(sessions.token, parsed.data.token), gt(sessions.expiresAt, new Date())),
      ).limit(1);
      if (!reset || reset.userAgent !== "admin-password-reset") return false;
      const [admin] = await tx.select().from(users).where(eq(users.id, reset.userId)).limit(1);
      if (!admin || admin.role !== "super_admin" || admin.deletedAt || !["active", "registered"].includes(admin.status)) {
        await tx.delete(sessions).where(eq(sessions.token, parsed.data.token));
        return false;
      }
      await tx.update(users).set({
        passwordHash: await hashPassword(parsed.data.password),
        updatedAt: new Date(),
      }).where(eq(users.id, admin.id));
      await tx.delete(sessions).where(eq(sessions.userId, admin.id));
      return true;
    });
    if (!outcome) return NextResponse.json({ error: "This reset link is invalid or expired. Request a new one." }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Administrator password updated. Sign in with the new password." });
  }

  return NextResponse.json({ error: "Invalid password recovery request" }, { status: 400 });
}
