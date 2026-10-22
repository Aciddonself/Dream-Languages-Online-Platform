import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { requireRole } from "@/lib/rbac";
import { db } from "@/db";
import { classes, departments, enrolments, timetableSessions } from "@/db/schema";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/ai-tutor", label: "AI Tutor", icon: "🎓" },
  { href: "/student/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/student/fees", label: "Fees", icon: "💰" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
];

export const dynamic = "force-dynamic";

export default async function StudentTimetablePage() {
  const user = await requireRole(["student"]);
  const activeClasses = await db.select({ id: enrolments.classId }).from(enrolments)
    .where(and(eq(enrolments.studentId, user.id), eq(enrolments.status, "active")));
  const classIds = activeClasses.map((item) => item.id).filter((id): id is string => Boolean(id));

  // Fetch class sessions + open department sessions
  const sessions = await db
    .select({
      id: timetableSessions.id,
      title: timetableSessions.title,
      startsAt: timetableSessions.startsAt,
      endsAt: timetableSessions.endsAt,
      room: timetableSessions.room,
      className: classes.name,
      departmentName: departments.name,
      flagEmoji: departments.flagEmoji,
      hasMeeting: timetableSessions.meetUrl,
      liveStartedAt: timetableSessions.liveStartedAt,
      liveEndedAt: timetableSessions.liveEndedAt,
    })
    .from(timetableSessions)
    .leftJoin(classes, eq(timetableSessions.classId, classes.id))
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .where(
      and(
        classIds.length > 0
          ? or(inArray(timetableSessions.classId, classIds), isNull(timetableSessions.classId))
          : isNull(timetableSessions.classId),
        gt(timetableSessions.endsAt, new Date())
      )
    )
    .orderBy(asc(timetableSessions.startsAt))
    .limit(100);

  return (
    <PortalShell title="Student Timetable" nav={nav}>
      <h1 className="display-font mb-2 text-3xl font-bold">My Timetable & Live Classes</h1>
      <p className="mb-5 text-sm opacity-70">
        Your scheduled language classes and live Google Meet sessions. When a class is live, click Join to enter the video call.
      </p>

      <div className="grid gap-3">
        {sessions.length ? (
          sessions.map((session) => {
            const isLive = Boolean(session.liveStartedAt && !session.liveEndedAt);
            return (
              <GlassCard
                key={session.id}
                className={`flex flex-wrap items-center justify-between gap-4 p-5 border transition-all ${
                  isLive
                    ? "border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/10"
                    : "border-white/10"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {session.departmentName && (
                      <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                        {session.flagEmoji ? `${session.flagEmoji} ` : ""}
                        {session.departmentName}
                      </span>
                    )}
                    {isLive && (
                      <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        LIVE NOW ON GOOGLE MEET
                      </span>
                    )}
                  </div>
                  <h2 className="font-semibold text-lg">{session.title}</h2>
                  <p className="text-sm opacity-70">
                    {session.className ?? "Open Language Session"} ·{" "}
                    {session.startsAt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} ·{" "}
                    {session.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {session.endsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {session.room ? ` · ${session.room}` : ""}
                  </p>
                </div>
                <div>
                  {session.hasMeeting ? (
                    <a
                      href={`/api/portal/sessions/${session.id}/join`}
                      target="_blank"
                      rel="noreferrer"
                      className={`rounded-xl px-5 py-2.5 font-bold text-sm shadow flex items-center gap-2 transition-all ${
                        isLive
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:scale-105"
                          : "bg-blue-600 text-white hover:bg-blue-500"
                      }`}
                    >
                      <span>🎥</span>
                      <span>{isLive ? "Join Live Class" : "Join Class"}</span>
                    </a>
                  ) : (
                    <span className="text-sm opacity-60">Meeting link not yet available</span>
                  )}
                </div>
              </GlassCard>
            );
          })
        ) : (
          <GlassCard className="p-8 text-center text-sm opacity-70">
            No upcoming sessions scheduled for your active classes yet. Check back soon!
          </GlassCard>
        )}
      </div>
    </PortalShell>
  );
}
