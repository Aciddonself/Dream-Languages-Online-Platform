type SessionDuration = { id: string; startsAt: Date; endsAt: Date };
type AttendanceDuration = {
  sessionId: string | null;
  studentId: string | null;
  status: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
};

export function calculateAttendancePercent(
  sessions: readonly SessionDuration[],
  records: readonly AttendanceDuration[],
  studentId: string,
) {
  let expectedMinutes = 0;
  let attendedMinutes = 0;
  const recordsBySessionAndStudent = new Map(
    records.map((record) => [`${record.sessionId}:${record.studentId}`, record]),
  );

  for (const session of sessions) {
    const expected = Math.max(0, (session.endsAt.getTime() - session.startsAt.getTime()) / 60_000);
    expectedMinutes += expected;
    const record = recordsBySessionAndStudent.get(`${session.id}:${studentId}`);
    if (!record || record.status !== "present") continue;
    if (!record.checkInAt) {
      attendedMinutes += expected;
      continue;
    }
    const start = Math.max(record.checkInAt.getTime(), session.startsAt.getTime());
    const end = Math.min((record.checkOutAt ?? session.endsAt).getTime(), session.endsAt.getTime());
    attendedMinutes += Math.max(0, (end - start) / 60_000);
  }

  return expectedMinutes ? Math.min(100, Math.round((attendedMinutes / expectedMinutes) * 100)) : 0;
}
