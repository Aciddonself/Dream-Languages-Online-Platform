type Session = { id: string; startsAt: Date; endsAt: Date };
type RecordRow = { sessionId: string | null; studentId: string | null; status: string; checkInAt: Date | null; checkOutAt: Date | null };

function attendedMinutes(session: Session, record: RecordRow | undefined) {
  if (!record || record.status !== "present") return 0;
  const expected = Math.max(0, (session.endsAt.getTime() - session.startsAt.getTime()) / 60_000);
  if (!record.checkInAt) return expected;
  const start = Math.max(record.checkInAt.getTime(), session.startsAt.getTime());
  const end = Math.min((record.checkOutAt ?? session.endsAt).getTime(), session.endsAt.getTime());
  return Math.max(0, (end - start) / 60_000);
}

export function attendanceTrend(sessions: readonly Session[], records: readonly RecordRow[], studentId: string) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
  const recordMap = new Map(records.map((record) => [`${record.sessionId}:${record.studentId}`, record]));
  return months.map((month) => {
    const matching = sessions.filter((session) => session.startsAt.getFullYear() === month.getFullYear() && session.startsAt.getMonth() === month.getMonth());
    const expected = matching.reduce((sum, session) => sum + Math.max(0, (session.endsAt.getTime() - session.startsAt.getTime()) / 60_000), 0);
    const attended = matching.reduce((sum, session) => sum + attendedMinutes(session, recordMap.get(`${session.id}:${studentId}`)), 0);
    return {
      month: month.toLocaleDateString("en", { month: "short" }),
      percent: expected ? Math.min(100, Math.round(attended / expected * 100)) : 0,
      sessions: matching.length,
    };
  });
}

export function classAttendanceTrend(sessions: readonly Session[], records: readonly RecordRow[], enrollmentCounts: ReadonlyMap<string, number>) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
  const recordsBySession = new Map<string, RecordRow[]>();
  for (const record of records) {
    if (!record.sessionId) continue;
    const list = recordsBySession.get(record.sessionId) ?? [];
    list.push(record);
    recordsBySession.set(record.sessionId, list);
  }
  return months.map((month) => {
    const matching = sessions.filter((session) => session.startsAt.getFullYear() === month.getFullYear() && session.startsAt.getMonth() === month.getMonth());
    let expected = 0;
    let attended = 0;
    for (const session of matching) {
      const headcount = enrollmentCounts.get(session.id) ?? 0;
      const duration = Math.max(0, (session.endsAt.getTime() - session.startsAt.getTime()) / 60_000);
      expected += duration * headcount;
      for (const record of recordsBySession.get(session.id) ?? []) attended += attendedMinutes(session, record);
    }
    return { month: month.toLocaleDateString("en", { month: "short" }), percent: expected ? Math.min(100, Math.round(attended / expected * 100)) : 0, sessions: matching.length };
  });
}
