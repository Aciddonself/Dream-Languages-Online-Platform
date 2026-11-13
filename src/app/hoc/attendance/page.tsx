import { and, count, eq, gte, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { AttendanceSessionPanel } from "@/components/attendance-session-panel";
import { AttendanceTrendChart } from "@/components/attendance-trend-chart";
import { PortalShell } from "@/components/portal-shell";
import { db } from "@/db";
import { attendance, classes, enrolments, timetableSessions } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { classAttendanceTrend } from "@/lib/attendance-trends";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/hoc", label: "Dashboard", icon: "🏠" },
  { href: "/hoc/live-classes", label: "Live Classes", icon: "🎥" },
  { href: "/hoc/attendance", label: "Attendance", icon: "✅" },
  { href: "/hoc/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/hoc/community", label: "Class discussions", icon: "💬" },
];

export default async function HocAttendancePage() {
  const user = await requireRole(["head_academics", "super_admin"]);
  const since = new Date(new Date().getTime() - 7 * 24 * 60 * 60_000);
  const sessions = await db
    .select({
      id: timetableSessions.id,
      title: timetableSessions.title,
      className: classes.name,
      startsAt: timetableSessions.startsAt,
      endsAt: timetableSessions.endsAt,
      liveStartedAt: timetableSessions.liveStartedAt,
      liveEndedAt: timetableSessions.liveEndedAt,
      teacherCheckInAt: timetableSessions.teacherCheckInAt,
      teacherCheckOutAt: timetableSessions.teacherCheckOutAt,
      meetUrl: timetableSessions.meetUrl,
    })
    .from(timetableSessions)
    .leftJoin(classes, eq(timetableSessions.classId, classes.id))
    .where(and(
      gte(timetableSessions.endsAt, since),
      or(isNull(classes.deletedAt), isNull(timetableSessions.classId)),
    ))
    .orderBy(timetableSessions.startsAt)
    .limit(60);

  const completed = await db
    .select({ id: timetableSessions.id, classId: timetableSessions.classId, startsAt: timetableSessions.startsAt, endsAt: timetableSessions.endsAt })
    .from(timetableSessions)
    .where(isNotNull(timetableSessions.liveEndedAt));
  const classIds: string[] = [...new Set<string>(completed.map((session: { classId: string | null }) => session.classId).filter((id: string | null): id is string => Boolean(id)))];
  const counts = classIds.length
    ? await db.select({ classId: enrolments.classId, students: count() }).from(enrolments)
      .where(and(inArray(enrolments.classId, classIds), eq(enrolments.status, "active"))).groupBy(enrolments.classId)
    : [];
  const countByClass = new Map(counts.map((item) => [item.classId, item.students]));
  const completedIds = completed.map((session) => session.id);
  const records = completedIds.length
    ? await db.select({ sessionId: attendance.sessionId, studentId: attendance.studentId, status: attendance.status, checkInAt: attendance.checkInAt, checkOutAt: attendance.checkOutAt })
      .from(attendance).where(inArray(attendance.sessionId, completedIds))
    : [];
  const trend = classAttendanceTrend(completed, records, new Map(completed.map((session) => [session.id, session.classId ? countByClass.get(session.classId) ?? 0 : 0])));

  return (
    <PortalShell title="Head of Academics & Languages" nav={nav}>
      <div className="mb-5">
        <h1 className="display-font text-3xl font-bold">School Attendance</h1>
        <p className="text-sm opacity-65">Review attendance trends across language classes and manage records for recent sessions.</p>
      </div>
      <AttendanceTrendChart title="School-wide attendance" months={trend} />
      <AttendanceSessionPanel sessions={sessions.map((session) => ({
        ...session,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        liveStartedAt: session.liveStartedAt?.toISOString() ?? null,
        liveEndedAt: session.liveEndedAt?.toISOString() ?? null,
        teacherCheckInAt: session.teacherCheckInAt?.toISOString() ?? null,
        teacherCheckOutAt: session.teacherCheckOutAt?.toISOString() ?? null,
      }))} audience="teacher" />
    </PortalShell>
  );
}
