import { and, eq, gte, isNull, or } from "drizzle-orm";
import { AttendanceSessionPanel } from "@/components/attendance-session-panel";
import { PortalShell } from "@/components/portal-shell";
import { db } from "@/db";
import { classes, timetableSessions } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

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
  return (
    <PortalShell title="Teacher Portal" nav={nav}>
      <div className="mb-5">
        <h1 className="display-font text-3xl font-bold">Class Attendance</h1>
        <p className="text-sm opacity-65">Start class to record your attendance, monitor student check-ins, and confirm or correct records. The roster never exposes student phone numbers.</p>
      </div>
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
