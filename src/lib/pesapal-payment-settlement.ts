import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, feeSchedules, payments, users } from "@/db/schema";
import { recordFeeIncome } from "@/lib/finance-cashbook";
import { getPesapalTransactionStatus } from "@/lib/pesapal";

export async function settlePesapalPayment(reference: string, trackingId: string) {
  const [payment] = await db.select().from(payments).where(and(eq(payments.reference, reference), eq(payments.method, "pesapal"))).limit(1);
  if (!payment?.studentId) return "not-found" as const;
  if (payment.status === "verified") return "success" as const;
  if (payment.status !== "pending") return "failed" as const;

  let status;
  try { status = await getPesapalTransactionStatus(trackingId); }
  catch { return "verification-pending" as const; }
  const statusCode = Number(status.status_code);
  const providerState = status.payment_status_description?.toLowerCase();
  if (status.merchant_reference !== reference) return "verification-pending" as const;
  if (statusCode === 2 || providerState === "failed") {
    await db.update(payments).set({ status: "rejected" }).where(and(eq(payments.id, payment.id), eq(payments.status, "pending")));
    return "failed" as const;
  }
  if (statusCode !== 1 || providerState !== "completed" || status.currency !== payment.currency || Number(status.amount) !== payment.amount) {
    return "verification-pending" as const;
  }

  return db.transaction(async (tx: any) => {
    const [current] = await tx.select().from(payments).where(eq(payments.id, payment.id)).for("update").limit(1);
    if (!current) return "not-found" as const;
    if (current.status === "verified") return "success" as const;
    if (current.status !== "pending" || current.method !== "pesapal" || current.reference !== reference) return "failed" as const;
    const [student] = await tx.select({ id: users.id }).from(users).where(eq(users.id, current.studentId)).for("update").limit(1);
    if (!student) return "verification-pending" as const;
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
    await recordFeeIncome(tx, { paymentId: current.id, actorId: current.studentId, amount: current.amount, currency: current.currency, method: current.method, reference: current.reference, date: now });
    await tx.insert(auditLogs).values({ actorId: current.studentId, action: "verify_pesapal_payment", entityType: "payment", entityId: current.id, after: { reference, trackingId, amount: current.amount, currency: current.currency, confirmationCode: status.confirmation_code ?? null, paymentMethod: status.payment_method ?? null } });
    return "success" as const;
  });
}
