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
  { href: "/teacher", label: "Dashboard", icon: "🏠" },
  { href: "/teacher/classes", label: "My Classes", icon: "📚" },
  { href: "/teacher/attendance", label: "Attendance", icon: "✅" },
  { href: "/teacher/materials", label: "Materials", icon: "📄" },
  { href: "/teacher/exams", label: "Exams", icon: "📝" },
  { href: "/teacher/community", label: "Class discussions", icon: "💬" },
  { href: "/teacher/live", label: "Live Classes", icon: "🎥" },
];

export default async function TeacherAttendancePage() {
  const user = await requireRole(["teacher", "head_academics", "super_admin"]);
  const sessionFilter = user.role === "teacher"
    ? eq(timetableSessions.teacherId, user.id)
    : undefined;
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
      sessionFilter,
    ))
    .orderBy(timetableSessions.startsAt)
    .limit(30);
  const completed = await db.select({ id: timetableSessions.id, classId: timetableSessions.classId, startsAt: timetableSessions.startsAt, endsAt: timetableSessions.endsAt })
    .from(timetableSessions).where(and(isNotNull(timetableSessions.liveEndedAt), sessionFilter));
  const classIds: string[] = [...new Set<string>(completed.map((session: { classId: string | null }) => session.classId).filter((id: string | null): id is string => Boolean(id)))];
  const counts: Array<{ classId: string; students: number }> = classIds.length ? await db.select({ classId: enrolments.classId, students: count() }).from(enrolments)
    .where(and(inArray(enrolments.classId, classIds), eq(enrolments.status, "active"))).groupBy(enrolments.classId) : [];
  const countByClass = new Map<string, number>(counts.map((item) => [item.classId, item.students]));
  const completedIds = completed.map((session) => session.id);
  const records = completedIds.length ? await db.select({ sessionId: attendance.sessionId, studentId: attendance.studentId, status: attendance.status, checkInAt: attendance.checkInAt, checkOutAt: attendance.checkOutAt })
    .from(attendance).where(inArray(attendance.sessionId, completedIds)) : [];
  const trend = classAttendanceTrend(completed, records, new Map<string, number>(completed.map((session) => [session.id, session.classId ? countByClass.get(session.classId) ?? 0 : 0])));
  return (
    <PortalShell title="Teacher Portal" nav={nav}>
      <div className="mb-5">
        <h1 className="display-font text-3xl font-bold">Class Attendance</h1>
        <p className="text-sm opacity-65">Start class to record your attendance, monitor student check-ins, and confirm or correct records. The roster never exposes student phone numbers.</p>
      </div>
      <AttendanceTrendChart title="Class attendance" months={trend} />
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
