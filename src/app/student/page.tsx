import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard, GlassButton, Badge } from "@/components/ui/glass";
import { StudentIdCard } from "@/components/id-card";
import { AttendanceRing } from "@/components/attendance-ring";
import { db } from "@/db";
import {
  assignments,
  attendance,
  announcements,
  classes,
  departments,
  enrolments,
  feeSchedules,
  holds,
  levels,
  timetableSessions,
} from "@/db/schema";
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { calculateAttendancePercent } from "@/lib/attendance";
import Link from "next/link";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/ai-tutor", label: "AI Tutor", icon: "🎓" },
  { href: "/student/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/student/fees", label: "Fees", icon: "💰" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
  { href: "/student/exams", label: "Exams", icon: "📝" },
  { href: "/student/results", label: "Results", icon: "📊" },
  { href: "/student/requests", label: "Requests", icon: "📨" },
  { href: "/student/materials", label: "Materials", icon: "📄" },
  { href: "/student/community", label: "Community", icon: "💬" },
  { href: "/student/reviews", label: "Share a Review", icon: "⭐" },
];

export default async function StudentDashboard() {
  const user = await requireRole(["student", "super_admin"]);
  const [enrollment] = await db
    .select({
      classId: classes.id,
      className: classes.name,
      departmentName: departments.name,
      levelName: levels.name,
    })
    .from(enrolments)
    .innerJoin(classes, eq(enrolments.classId, classes.id))
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .leftJoin(levels, eq(classes.levelId, levels.id))
    .where(eq(enrolments.studentId, user.id))
    .limit(1);

  const [attendanceSummary, feeSummary, activeHold, assignmentSummary, announcementRows, completedAttendanceSessions] = await Promise.all([
    db.select({ total: count() }).from(attendance).where(eq(attendance.studentId, user.id)),
    db.select({
      currency: feeSchedules.currency,
      balance: sql<number>`coalesce(sum(greatest(${feeSchedules.amount} - ${feeSchedules.paid}, 0)), 0)`,
    }).from(feeSchedules).where(eq(feeSchedules.studentId, user.id)).groupBy(feeSchedules.currency),
    db
      .select({ id: holds.id })
      .from(holds)
      .where(and(eq(holds.studentId, user.id), eq(holds.status, "active")))
      .limit(1),
    enrollment
      ? db
          .select({ total: count() })
          .from(assignments)
          .where(and(eq(assignments.classId, enrollment.classId), gt(assignments.dueAt, new Date())))
      : Promise.resolve([{ total: 0 }]),
    db.select().from(announcements).where(or(
      eq(announcements.audience, "all"),
      eq(announcements.audience, "students"),
      ...(enrollment ? [eq(announcements.classId, enrollment.classId)] : []),
    )).orderBy(desc(announcements.publishedAt)).limit(8),
    enrollment
      ? db.select({
          id: timetableSessions.id,
          startsAt: timetableSessions.startsAt,
          endsAt: timetableSessions.endsAt,
        }).from(timetableSessions).where(and(
          eq(timetableSessions.classId, enrollment.classId),
          isNotNull(timetableSessions.liveEndedAt),
        ))
      : Promise.resolve([]),
  ]);

  const completedSessionIds = completedAttendanceSessions.map((session) => session.id);
  const attendanceHistory = completedSessionIds.length
    ? await db.select({
        sessionId: attendance.sessionId,
        studentId: attendance.studentId,
        status: attendance.status,
        checkInAt: attendance.checkInAt,
        checkOutAt: attendance.checkOutAt,
      }).from(attendance).where(and(
        eq(attendance.studentId, user.id),
        inArray(attendance.sessionId, completedSessionIds),
      ))
    : [];
  const attendanceRate = calculateAttendancePercent(completedAttendanceSessions, attendanceHistory, user.id);

  // Check for currently active Live Class (Google Meet in session)
  const [activeLiveSession] = await db
    .select({
      id: timetableSessions.id,
      title: timetableSessions.title,
      startsAt: timetableSessions.startsAt,
      endsAt: timetableSessions.endsAt,
      meetUrl: timetableSessions.meetUrl,
      room: timetableSessions.room,
      liveStartedAt: timetableSessions.liveStartedAt,
    })
    .from(timetableSessions)
    .where(and(
      enrollment
        ? or(eq(timetableSessions.classId, enrollment.classId), isNull(timetableSessions.classId))
        : isNull(timetableSessions.classId),
      isNotNull(timetableSessions.liveStartedAt),
      isNull(timetableSessions.liveEndedAt),
      gt(timetableSessions.endsAt, new Date())
    ))
    .limit(1);

  // Upcoming scheduled sessions
  const upcomingSessions = await db
    .select({
      id: timetableSessions.id,
      title: timetableSessions.title,
      startsAt: timetableSessions.startsAt,
      endsAt: timetableSessions.endsAt,
      meetUrl: timetableSessions.meetUrl,
      room: timetableSessions.room,
      liveStartedAt: timetableSessions.liveStartedAt,
      liveEndedAt: timetableSessions.liveEndedAt,
    })
    .from(timetableSessions)
    .where(and(
      enrollment
        ? or(eq(timetableSessions.classId, enrollment.classId), isNull(timetableSessions.classId))
        : isNull(timetableSessions.classId),
      gt(timetableSessions.endsAt, new Date()),
      isNull(timetableSessions.liveEndedAt)
    ))
    .orderBy(timetableSessions.startsAt)
    .limit(4);

  const hasFeeBalance = feeSummary.some((item) => Number(item.balance) > 0);
  const feeBalanceLabel = feeSummary.map((item) => `${item.currency} ${Number(item.balance).toLocaleString()}`).join(" · ") || "No fee schedule";
  const registrationNumber = user.registrationNumber ?? "Not assigned";

  return (
    <PortalShell title="Student Portal" nav={nav}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="display-font text-3xl font-bold">Welcome, {user.firstName}</h1>
          <p className="text-sm opacity-60">Here&apos;s your learning overview.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/student/ai-tutor">
            <GlassButton className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold">
              🎓 Ask AI Tutor
            </GlassButton>
          </Link>
          <Link href="/api/portal/documents/admission"><GlassButton variant="glass">Admission form PDF</GlassButton></Link>
          <Link href="/api/portal/documents/results"><GlassButton>Test & exam results PDF</GlassButton></Link>
        </div>
      </div>

      {/* Prominent Active Google Meet Live Class Notification */}
      {activeLiveSession && (
        <div className="mb-6 rounded-2xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-950/40 via-blue-950/30 to-slate-900/40 p-5 shadow-xl shadow-emerald-500/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-black text-2xl font-bold shadow animate-pulse">
              🎥
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-black uppercase tracking-wider animate-ping">
                  LIVE NOW
                </span>
                <span className="text-xs font-semibold text-emerald-400">
                  Interactive Class In Session on Google Meet
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-0.5">{activeLiveSession.title}</h3>
              <p className="text-xs opacity-75">
                Class is live right now! Click to join your teacher and classmates.
              </p>
            </div>
          </div>
          {activeLiveSession.meetUrl && (
            <a
              href={`/api/portal/sessions/${activeLiveSession.id}/join`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-bold text-white shadow-lg hover:opacity-95 hover:scale-105 transition-all flex items-center gap-2 text-sm"
            >
              <span>🔴 Join Google Meet Class</span>
              <span>→</span>
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <GlassCard className="p-5">
          <div className="mb-3 text-xs font-semibold uppercase opacity-60">Attendance</div>
          <div className="flex items-center gap-3">
            <AttendanceRing percentage={attendanceRate} hasSessions={completedAttendanceSessions.length > 0} />
            <div>
              <div className="text-sm font-semibold">{attendanceSummary[0]?.total ?? 0} records</div>
              <Link href="/student/attendance" className="mt-1 inline-block text-xs font-semibold text-[var(--brand-primary)] hover:underline">
                View attendance
              </Link>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs font-semibold opacity-60 uppercase">Fee Balance</div>
          <div className="text-base font-bold mt-1">{feeBalanceLabel}</div>
          <Badge tone={activeHold.length ? "warning" : "success"} className="mt-2">
            {activeHold.length ? "ON HOLD" : hasFeeBalance ? "BALANCE DUE" : "CLEAR"}
          </Badge>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs font-semibold opacity-60 uppercase">Assignments Due</div>
          <div className="text-3xl font-bold text-[var(--brand-primary)] mt-1">{assignmentSummary[0]?.total ?? 0}</div>
          <div className="text-xs opacity-60 mt-1">Upcoming assignments</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs font-semibold opacity-60 uppercase">Level Progress</div>
          <div className="text-xl font-bold text-[var(--brand-accent)] mt-1">{enrollment?.levelName ?? "Not assigned"}</div>
        </GlassCard>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <GlassCard className="p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Next Scheduled Class</div>
            <Link href="/student/timetable" className="text-xs text-indigo-400 underline hover:text-indigo-300">
              Full Timetable
            </Link>
          </div>
          <div className="glass p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">{upcomingSessions[0]?.title ?? enrollment?.className ?? "No class assigned"}</div>
              <div className="text-sm opacity-60">
                {upcomingSessions[0]
                  ? `${new Date(upcomingSessions[0].startsAt).toLocaleString()}${upcomingSessions[0].room ? ` · ${upcomingSessions[0].room}` : ""}`
                  : "No upcoming session scheduled"}
              </div>
            </div>
            {upcomingSessions[0]?.meetUrl ? (
              <a
                className="btn-glass btn-glass-primary px-4 py-2 rounded-xl font-semibold flex items-center gap-1.5"
                href={`/api/portal/sessions/${upcomingSessions[0].id}/join`}
                target="_blank"
                rel="noreferrer"
              >
                <span>🎥 Join Meet</span>
              </a>
            ) : (
              <GlassButton disabled>Join Class</GlassButton>
            )}
          </div>
          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">Upcoming Sessions</div>
            <ul className="space-y-2 text-sm">
              {upcomingSessions.length ? upcomingSessions.map((session) => (
                <li key={session.id} className="glass flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>{new Date(session.startsAt).toLocaleString()} · {session.title}</span>
                  {session.meetUrl && (
                    <a
                      className="font-semibold text-emerald-400 underline hover:text-emerald-300"
                      href={`/api/portal/sessions/${session.id}/join`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Join Class ↗
                    </a>
                  )}
                </li>
              )) : <li className="glass px-3 py-2">No upcoming sessions.</li>}
            </ul>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="font-semibold mb-3">Digital ID Card</div>
          <StudentIdCard
            name={user.displayName ?? "Student"}
            registrationNumber={registrationNumber}
            department={enrollment?.departmentName ?? "Pending placement"}
            level={enrollment?.levelName ?? "Not assigned"}
            photoUrl={user.avatarUrl ?? undefined}
          />
        </GlassCard>
      </div>

      <GlassCard className="p-5 mb-6" strong>
        <div className="text-sm opacity-70">Official student registration number</div>
        <div className="font-mono text-xl font-semibold">{registrationNumber}</div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="font-semibold mb-3">Announcements</div>
        <ul className="space-y-2 text-sm">
          {announcementRows.length ? announcementRows.map((announcement) => (
            <li className="glass px-3 py-2" key={announcement.id}>
              <div className="font-semibold">{announcement.title}</div>
              <div className="mt-1 opacity-75">{announcement.body}</div>
              <div className="mt-1 text-xs opacity-50">{announcement.publishedAt.toLocaleString()}</div>
            </li>
          )) : <li className="glass px-3 py-2 opacity-70">There are no new announcements.</li>}
        </ul>
      </GlassCard>
    </PortalShell>
  );
}
