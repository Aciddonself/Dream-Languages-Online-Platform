import { and, asc, count, eq, gte, inArray, isNotNull, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { AttendanceSessionPanel } from "@/components/attendance-session-panel";
import { AttendanceTrendChart } from "@/components/attendance-trend-chart";
import { PortalShell } from "@/components/portal-shell";
import { db } from "@/db";
import { attendance, classes, departments, enrolments, timetableSessions } from "@/db/schema";
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

export default async function HocAttendancePage({ searchParams }: { searchParams: Promise<{ departmentId?: string }> }) {
  const user = await requireRole(["head_academics", "super_admin"]);
  const { departmentId = "" } = await searchParams;
  const languageDepartments = await db.select({ id: departments.id, name: departments.name }).from(departments)
    .where(and(eq(departments.isLanguage, true), isNull(departments.deletedAt))).orderBy(asc(departments.name));
  const since = new Date(new Date().getTime() - 7 * 24 * 60 * 60_000);
  const sessions = await db
    .select({
      id: timetableSessions.id,
      title: timetableSessions.title,
      className: classes.name,
      departmentName: departments.name,
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
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .where(and(
      gte(timetableSessions.endsAt, since),
      or(isNull(classes.deletedAt), isNull(timetableSessions.classId)),
      departmentId === "unassigned" ? isNull(classes.departmentId) : departmentId ? eq(classes.departmentId, departmentId) : undefined,
    ))
    .orderBy(timetableSessions.startsAt)
    .limit(60);

  const completed = await db
    .select({ id: timetableSessions.id, classId: timetableSessions.classId, startsAt: timetableSessions.startsAt, endsAt: timetableSessions.endsAt })
    .from(timetableSessions)
    .leftJoin(classes, eq(timetableSessions.classId, classes.id))
    .where(and(isNotNull(timetableSessions.liveEndedAt), departmentId === "unassigned" ? isNull(classes.departmentId) : departmentId ? eq(classes.departmentId, departmentId) : undefined));
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
      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <select name="departmentId" defaultValue={departmentId} className="glass min-w-56 px-3 py-2.5">
          <option value="">All language departments</option>
          <option value="unassigned">Department unassigned</option>
          {languageDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <button type="submit" className="glass rounded-xl px-4 py-2.5 font-semibold">Filter attendance</button>
        {departmentId && <Link href="/hoc/attendance" className="glass rounded-xl px-4 py-2.5">Clear</Link>}
      </form>
      <AttendanceTrendChart title="School-wide attendance" months={trend} />
      <AttendanceSessionPanel sessions={sessions.map((session) => ({
        ...session,
        className: session.className ? `${session.departmentName ?? "Unassigned"} · ${session.className}` : session.className,
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
