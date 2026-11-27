import { getStudentFinanceAccess } from "@/lib/student-finance-access";

export async function getStudentExamEligibility(studentId: string, _classId: string) {
  const access = await getStudentFinanceAccess(studentId);
  const feeBalance = access.balanceByCurrency.reduce((sum, item) => sum + item.amount, 0);
  const feeBalanceLabel = access.balanceByCurrency.map((item) => `${item.currency} ${item.amount.toLocaleString()}`).join(" · ") || (access.feesComplete ? "Fees complete" : "No fee schedule");
  return {
    feeBalance,
    feeBalanceLabel,
    feesClear: access.feesComplete,
    eligible: access.canLearn,
    basis: access.override ? "admin_override" as const : access.feesComplete ? "fees_clear" as const : "not_eligible" as const,
    overrideReason: access.override?.reason ?? null,
  };
}
