import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, feeSchedules, studentAccessOverrides, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { clientIp } from "@/lib/rate-limit";

function canManage(role: string) { return role === "admin" || role === "super_admin"; }

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!canManage(actor.role)) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  const students = await db.select({ id: users.id, name: users.displayName, firstName: users.firstName, lastName: users.lastName, email: users.email, registrationNumber: users.registrationNumber, status: users.status })
    .from(users).where(and(eq(users.role, "student"), isNull(users.deletedAt))).orderBy(desc(users.createdAt)).limit(500);
  const ids = students.map((student) => student.id);
  if (!ids.length) return NextResponse.json({ students: [] });
  const [fees, overrides] = await Promise.all([
    db.select({ studentId: feeSchedules.studentId, amount: feeSchedules.amount, paid: feeSchedules.paid, currency: feeSchedules.currency })
      .from(feeSchedules).where(inArray(feeSchedules.studentId, ids)),
    db.select({ studentId: studentAccessOverrides.studentId, reason: studentAccessOverrides.reason, grantedAt: studentAccessOverrides.grantedAt })
      .from(studentAccessOverrides).where(inArray(studentAccessOverrides.studentId, ids)),
  ]);
  return NextResponse.json({ students: students.map((student) => {
    const studentFees = fees.filter((fee) => fee.studentId === student.id);
    const balance = new Map<string, number>();
    for (const fee of studentFees) balance.set(fee.currency, (balance.get(fee.currency) ?? 0) + Math.max(0, fee.amount - fee.paid));
    const override = overrides.find((item) => item.studentId === student.id) ?? null;
    return { ...student, fullName: student.name || [student.firstName, student.lastName].filter(Boolean).join(" ") || student.email, feesComplete: studentFees.length > 0 && studentFees.every((fee) => fee.paid >= fee.amount), hasFeeSchedule: studentFees.length > 0, balances: [...balance].map(([currency, amount]) => ({ currency, amount })), override };
  }) });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!canManage(actor.role)) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = z.discriminatedUnion("action", [
    z.object({ action: z.literal("grant"), studentId: z.string().uuid(), reason: z.string().trim().min(5).max(500) }).strict(),
    z.object({ action: z.literal("revoke"), studentId: z.string().uuid() }).strict(),
  ]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [student] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, parsed.data.studentId), eq(users.role, "student"), isNull(users.deletedAt))).limit(1);
  if (!student) return NextResponse.json({ error: "Active student not found" }, { status: 404 });
  if (parsed.data.action === "grant") {
    const now = new Date();
    await db.insert(studentAccessOverrides).values({ studentId: student.id, reason: parsed.data.reason, grantedBy: actor.id, grantedAt: now })
      .onConflictDoUpdate({ target: studentAccessOverrides.studentId, set: { reason: parsed.data.reason, grantedBy: actor.id, grantedAt: now } });
    await db.insert(auditLogs).values({ actorId: actor.id, action: "grant_student_fee_access_exception", entityType: "user", entityId: student.id, after: { reason: parsed.data.reason, grantedAt: now.toISOString() }, ip: clientIp(request), userAgent: request.headers.get("user-agent") });
    return NextResponse.json({ ok: true, grantedAt: now.toISOString() });
  }
  const [removed] = await db.delete(studentAccessOverrides).where(eq(studentAccessOverrides.studentId, student.id)).returning({ reason: studentAccessOverrides.reason });
  if (removed) await db.insert(auditLogs).values({ actorId: actor.id, action: "revoke_student_fee_access_exception", entityType: "user", entityId: student.id, before: { reason: removed.reason }, ip: clientIp(request), userAgent: request.headers.get("user-agent") });
  return NextResponse.json({ ok: true, revoked: Boolean(removed) });
}
