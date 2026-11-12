import { NextResponse } from "next/server";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, feeSchedules, payments, receipts, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const submitSchema = z.object({
  amount: z.number().int().positive().max(100_000_000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3,8}$/),
  method: z.enum(["bank", "momo", "airtel_money", "cash", "other"]),
  reference: z.string().trim().min(2).max(160),
}).strict();

const decisionSchema = z.object({
  paymentId: z.string().uuid(),
  action: z.enum(["verify", "reject"]),
  reason: z.string().trim().max(500).optional(),
}).strict();

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "student") return NextResponse.json({ error: "Only students can submit payment records" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [schedule] = await db.select({ id: feeSchedules.id })
    .from(feeSchedules)
    .where(and(eq(feeSchedules.studentId, actor.id), eq(feeSchedules.currency, parsed.data.currency), gt(feeSchedules.amount, feeSchedules.paid)))
    .limit(1);
  if (!schedule) return NextResponse.json({ error: `No outstanding ${parsed.data.currency} fee schedule was found. Contact Finance if this is incorrect.` }, { status: 409 });
  const [balance] = await db.select({ amount: sql<number>`coalesce(sum(${feeSchedules.amount} - ${feeSchedules.paid}), 0)::int` })
    .from(feeSchedules).where(and(eq(feeSchedules.studentId, actor.id), eq(feeSchedules.currency, parsed.data.currency)));
  if (parsed.data.amount > Number(balance?.amount ?? 0)) {
    return NextResponse.json({ error: `Amount is greater than the outstanding balance (${parsed.data.currency} ${Number(balance?.amount ?? 0).toLocaleString()})` }, { status: 400 });
  }

  const [payment] = await db.insert(payments).values({
    studentId: actor.id,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    method: parsed.data.method,
    reference: parsed.data.reference,
    status: "pending",
  }).returning({ id: payments.id, amount: payments.amount, currency: payments.currency, status: payments.status, createdAt: payments.createdAt });
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "submit_payment_for_verification",
    entityType: "payment",
    entityId: payment.id,
    after: { amount: payment.amount, currency: payment.currency, method: parsed.data.method, reference: parsed.data.reference },
  });
  return NextResponse.json({ ok: true, payment }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["finance", "super_admin"].includes(actor.role)) return NextResponse.json({ error: "Finance access required" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.action === "reject" && !parsed.data.reason) {
    return NextResponse.json({ error: "Add a reason when rejecting a payment" }, { status: 400 });
  }

  const result = await db.transaction(async (tx: any) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, parsed.data.paymentId)).limit(1);
    if (!payment) return { error: "Payment record not found", status: 404 as const };
    if (payment.status !== "pending") return { error: "This payment has already been reviewed", status: 409 as const };

    if (parsed.data.action === "reject") {
      const [updated] = await tx.update(payments).set({ status: "rejected", verifiedBy: actor.id, verifiedAt: new Date() })
        .where(and(eq(payments.id, payment.id), eq(payments.status, "pending"))).returning({ id: payments.id });
      if (!updated) return { error: "This payment has already been reviewed", status: 409 as const };
      if (!updated) return { error: "This payment has already been reviewed", status: 409 as const };
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "reject_payment", entityType: "payment", entityId: payment.id,
        before: { status: payment.status }, after: { status: "rejected", reason: parsed.data.reason } });
      return { ok: true as const, status: "rejected" };
    }

    if (!payment.studentId) return { error: "This payment is not linked to a student account", status: 409 as const };
    // Serialize finance reviews for the same student to prevent two concurrent payments
    // from both applying against the same fee balance.
    const [lockedStudent] = await tx.select({ id: users.id }).from(users).where(eq(users.id, payment.studentId)).for("update").limit(1);
    if (!lockedStudent) return { error: "Student account not found", status: 404 as const };

    const schedules = await tx.select().from(feeSchedules).where(and(
      eq(feeSchedules.studentId, payment.studentId!),
      eq(feeSchedules.currency, payment.currency),
      sql`${feeSchedules.paid} < ${feeSchedules.amount}`,
    )).orderBy(asc(feeSchedules.dueDate), asc(feeSchedules.createdAt));
    const outstanding = schedules.reduce((sum: number, row: { amount: number; paid: number }) => sum + Math.max(row.amount - row.paid, 0), 0);
    if (payment.amount > outstanding) return { error: `Payment exceeds the student's outstanding balance (${payment.currency} ${outstanding.toLocaleString()})`, status: 409 as const };
    if (!schedules.length) return { error: "No outstanding fee schedule can receive this payment", status: 409 as const };

    const [updated] = await tx.update(payments).set({ status: "verified", verifiedBy: actor.id, verifiedAt: new Date() })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "pending"))).returning({ id: payments.id });
    if (!updated) return { error: "This payment has already been reviewed", status: 409 as const };

    let remaining = payment.amount;
    for (const schedule of schedules) {
      if (!remaining) break;
      const balance = Math.max(schedule.amount - schedule.paid, 0);
      const allocated = Math.min(balance, remaining);
      const paid = schedule.paid + allocated;
      await tx.update(feeSchedules).set({ paid, status: paid >= schedule.amount ? "paid" : "partial" }).where(eq(feeSchedules.id, schedule.id));
      remaining -= allocated;
    }
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "verify_payment", entityType: "payment", entityId: payment.id,
      before: { status: payment.status }, after: { status: "verified", amount: payment.amount, currency: payment.currency } });
    return { ok: true as const, status: "verified" };
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
