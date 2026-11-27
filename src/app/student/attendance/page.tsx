import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { AttendanceSessionPanel } from "@/components/attendance-session-panel";
import { AttendanceTrendChart } from "@/components/attendance-trend-chart";
import { PortalShell } from "@/components/portal-shell";
import { db } from "@/db";
import { attendance, classes, enrolments, timetableSessions } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { calculateAttendancePercent } from "@/lib/attendance";
import { attendanceTrend } from "@/lib/attendance-trends";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/fees", label: "Fees", icon: "💰" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
  { href: "/student/exams", label: "Exams", icon: "📝" },
  { href: "/student/results", label: "Results", icon: "📊" },
  { href: "/student/materials", label: "Materials", icon: "📄" },
  { href: "/student/recordings", label: "Recorded classes", icon: "🎬" },
  { href: "/student/community", label: "Community", icon: "💬" },
  { href: "/student/reviews", label: "Share a Review", icon: "⭐" },
];

export default async function StudentAttendancePage() {
  const user = await requireRole(["student"]);
  const classesForStudent = await db
    .select({ id: classes.id, name: classes.name })
    .from(enrolments)
    .innerJoin(classes, eq(enrolments.classId, classes.id))
    .where(and(eq(enrolments.studentId, user.id), eq(enrolments.status, "active")));
  const classIds = classesForStudent.map((item) => item.id);
  const since = new Date(new Date().getTime() - 7 * 24 * 60 * 60_000);
  const completedSessions = classIds.length ? await db.select({
    id: timetableSessions.id,
    startsAt: timetableSessions.startsAt,
    endsAt: timetableSessions.endsAt,
  }).from(timetableSessions).where(and(inArray(timetableSessions.classId, classIds), isNotNull(timetableSessions.liveEndedAt))) : [];
  const completedIds = completedSessions.map((item) => item.id);
  const history = completedIds.length ? await db.select({
    sessionId: attendance.sessionId,
    studentId: attendance.studentId,
    status: attendance.status,
    checkInAt: attendance.checkInAt,
    checkOutAt: attendance.checkOutAt,
  }).from(attendance).where(and(inArray(attendance.sessionId, completedIds), eq(attendance.studentId, user.id))) : [];
  const overallPercent = calculateAttendancePercent(completedSessions, history, user.id);
  const monthlyTrend = attendanceTrend(completedSessions, history, user.id);
  const sessions = classIds.length
    ? await db
        .select({
          id: timetableSessions.id,
          title: timetableSessions.title,
          className: classes.name,
          startsAt: timetableSessions.startsAt,
          endsAt: timetableSessions.endsAt,
          liveStartedAt: timetableSessions.liveStartedAt,
          liveEndedAt: timetableSessions.liveEndedAt,
          meetUrl: timetableSessions.meetUrl,
        })
        .from(timetableSessions)
        .leftJoin(classes, eq(timetableSessions.classId, classes.id))
        .where(and(inArray(timetableSessions.classId, classIds), gte(timetableSessions.endsAt, since)))
        .orderBy(timetableSessions.startsAt)
        .limit(20)
    : [];
  return (
    <PortalShell title="Student Portal" nav={nav}>
      <div className="mb-5">
        <h1 className="display-font text-3xl font-bold">Class Attendance</h1>
        <p className="text-sm opacity-65">Check in and out during class. Your teacher confirms each attendance record. Attendance is calculated from completed scheduled class time.</p>
      </div>
      <AttendanceTrendChart title={`Overall attendance · ${overallPercent}%`} months={monthlyTrend} />
      <AttendanceSessionPanel sessions={sessions.map((session) => ({
        ...session,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        liveStartedAt: session.liveStartedAt?.toISOString() ?? null,
        liveEndedAt: session.liveEndedAt?.toISOString() ?? null,
      }))} audience="student" />
    </PortalShell>
  );
}
