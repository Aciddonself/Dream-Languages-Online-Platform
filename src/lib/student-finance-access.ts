import { eq } from "drizzle-orm";
import { db } from "@/db";
import { feeSchedules, studentAccessOverrides } from "@/db/schema";

export async function getStudentFinanceAccess(studentId: string) {
  const [fees, [override]] = await Promise.all([
    db.select({ amount: feeSchedules.amount, paid: feeSchedules.paid, currency: feeSchedules.currency })
      .from(feeSchedules).where(eq(feeSchedules.studentId, studentId)),
    db.select({ reason: studentAccessOverrides.reason, grantedAt: studentAccessOverrides.grantedAt })
      .from(studentAccessOverrides).where(eq(studentAccessOverrides.studentId, studentId)).limit(1),
  ]);
  const feesComplete = fees.length > 0 && fees.every((fee) => fee.paid >= fee.amount);
  const balances = new Map<string, number>();
  for (const fee of fees) balances.set(fee.currency, (balances.get(fee.currency) ?? 0) + Math.max(0, fee.amount - fee.paid));
  return {
    feesComplete,
    override: override ?? null,
    canLearn: feesComplete || Boolean(override),
    balanceByCurrency: [...balances].map(([currency, amount]) => ({ currency, amount })),
  };
}
