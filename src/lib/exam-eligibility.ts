import { and, eq, isNotNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendance, feeSchedules, timetableSessions } from "@/db/schema";

export async function getStudentExamEligibility(studentId: string, classId: string) {
  const [completedSessions, fees] = await Promise.all([
    db.select({
      id: timetableSessions.id,
      startsAt: timetableSessions.startsAt,
      endsAt: timetableSessions.endsAt,
    }).from(timetableSessions).where(and(
      eq(timetableSessions.classId, classId),
      isNotNull(timetableSessions.liveStartedAt),
      isNotNull(timetableSessions.liveEndedAt),
    )),
    db.select({ amount: feeSchedules.amount, paid: feeSchedules.paid, currency: feeSchedules.currency }).from(feeSchedules).where(eq(feeSchedules.studentId, studentId)),
  ]);
  const sessionIds = completedSessions.map((session) => session.id);
  const records = sessionIds.length
    ? await db.select({
        sessionId: attendance.sessionId,
        status: attendance.status,
        checkInAt: attendance.checkInAt,
        checkOutAt: attendance.checkOutAt,
      }).from(attendance).where(and(eq(attendance.studentId, studentId), inArray(attendance.sessionId, sessionIds)))
    : [];

  let expectedMinutes = 0;
  let attendedMinutes = 0;
  for (const session of completedSessions) {
    const expected = Math.max(0, (session.endsAt.getTime() - session.startsAt.getTime()) / 60_000);
    expectedMinutes += expected;
    const record = records.find((item) => item.sessionId === session.id && item.status === "present");
    if (!record) continue;
    if (!record.checkInAt) {
      attendedMinutes += expected;
      continue;
    }
    const start = Math.max(record.checkInAt.getTime(), session.startsAt.getTime());
    const end = Math.min((record.checkOutAt ?? session.endsAt).getTime(), session.endsAt.getTime());
    attendedMinutes += Math.max(0, (end - start) / 60_000);
  }
  const attendancePercent = expectedMinutes ? Math.min(100, Math.round(attendedMinutes / expectedMinutes * 100)) : 0;
  const feeBalance = fees.reduce((total, item) => total + Math.max(0, item.amount - item.paid), 0);
  const feesClear = fees.length > 0 && fees.every((item) => item.paid >= item.amount);
  const feeBalanceByCurrency = new Map<string, number>();
  for (const item of fees) feeBalanceByCurrency.set(item.currency, (feeBalanceByCurrency.get(item.currency) ?? 0) + Math.max(0, item.amount - item.paid));
  const feeBalanceLabel = [...feeBalanceByCurrency].map(([currency, balance]) => `${currency} ${balance.toLocaleString()}`).join(" · ") || "No fee schedule";
  return {
    attendancePercent,
    feeBalance,
    feeBalanceLabel,
    feesClear,
    eligible: attendancePercent >= 60 || feesClear,
    basis: attendancePercent >= 60 ? "attendance" as const : feesClear ? "fees_clear" as const : "not_eligible" as const,
  };
}
