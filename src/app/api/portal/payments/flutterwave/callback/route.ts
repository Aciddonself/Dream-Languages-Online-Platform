import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, feeSchedules, payments, users } from "@/db/schema";
import { recordFeeIncome } from "@/lib/finance-cashbook";

type VerifyResponse = { status?: string; data?: { status?: string; tx_ref?: string; amount?: number | string; currency?: string } };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const txRef = url.searchParams.get("tx_ref") ?? "";
  const transactionId = url.searchParams.get("transaction_id") ?? "";
  const returnTo = (result: string) => NextResponse.redirect(new URL(`/student/fees?payment=${result}`, url.origin), 303);
  if (!/^dla_[0-9a-f-]{36}$/i.test(txRef)) return returnTo("invalid");
  const [payment] = await db.select().from(payments).where(and(eq(payments.reference, txRef), eq(payments.method, "flutterwave"))).limit(1);
  if (!payment?.studentId) return returnTo("not-found");
  if (payment.status === "verified") return returnTo("success");
  if (payment.status !== "pending") return returnTo("failed");
  if (url.searchParams.get("status") !== "successful" || !/^\d+$/.test(transactionId)) return returnTo("failed");
  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) return returnTo("verification-pending");

  let verification: VerifyResponse;
  try {
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    verification = await response.json() as VerifyResponse;
    if (!response.ok || verification.status !== "success") return returnTo("verification-pending");
  } catch {
    return returnTo("verification-pending");
  }
  const details = verification.data;
  if (details?.status !== "successful" || details.tx_ref !== txRef || details.currency !== payment.currency || Number(details.amount) !== payment.amount) {
    return returnTo("verification-pending");
  }

  const result = await db.transaction(async (tx: any) => {
    const [current] = await tx.select().from(payments).where(eq(payments.id, payment.id)).for("update").limit(1);
    if (!current) return "not-found" as const;
    if (current.status === "verified") return "success" as const;
    if (current.status !== "pending" || current.method !== "flutterwave" || current.reference !== txRef) return "failed" as const;
    const [lockedStudent] = await tx.select({ id: users.id }).from(users).where(eq(users.id, current.studentId)).for("update").limit(1);
    if (!lockedStudent) return "verification-pending" as const;
    const schedules = await tx.select().from(feeSchedules).where(and(
      eq(feeSchedules.studentId, current.studentId),
      eq(feeSchedules.currency, current.currency),
      sql`${feeSchedules.paid} < ${feeSchedules.amount}`,
    )).orderBy(asc(feeSchedules.dueDate), asc(feeSchedules.createdAt)).for("update");
    const outstanding = schedules.reduce((sum: number, fee: { amount: number; paid: number }) => sum + Math.max(fee.amount - fee.paid, 0), 0);
    if (!schedules.length || current.amount > outstanding) return "verification-pending" as const;
    const now = new Date();
    const [updated] = await tx.update(payments).set({ status: "verified", verifiedBy: null, verifiedAt: now })
      .where(and(eq(payments.id, current.id), eq(payments.status, "pending"))).returning({ id: payments.id });
    if (!updated) return "verification-pending" as const;
    let remaining = current.amount;
    for (const fee of schedules) {
      if (!remaining) break;
      const paid = fee.paid + Math.min(Math.max(fee.amount - fee.paid, 0), remaining);
      remaining -= paid - fee.paid;
      await tx.update(feeSchedules).set({ paid, status: paid >= fee.amount ? "paid" : "partial" }).where(eq(feeSchedules.id, fee.id));
    }
    await recordFeeIncome(tx, { paymentId: current.id, actorId: current.studentId!, amount: current.amount, currency: current.currency, method: current.method, reference: current.reference, date: now });
    await tx.insert(auditLogs).values({ actorId: current.studentId, action: "verify_flutterwave_payment", entityType: "payment", entityId: current.id, after: { txRef, transactionId, amount: current.amount, currency: current.currency } });
    return "success" as const;
  });
  return returnTo(result);
}
