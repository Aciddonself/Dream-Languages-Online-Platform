import { asc, eq, gt, or } from "drizzle-orm";
import { requireRole } from "@/lib/rbac";
import { db } from "@/db";
import { classes, departments, timetableSessions, users } from "@/db/schema";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { AdminSessionCreate } from "@/components/admin-session-create";
import Link from "next/link";

const nav = [
  { href: "/hoc", label: "Dashboard", icon: "🏠" },
  { href: "/hoc/live-classes", label: "Live Classes", icon: "🎥" },
  { href: "/hoc/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/hoc/community", label: "Class discussions", icon: "💬" },
];

export const dynamic = "force-dynamic";

export default async function HocTimetablePage() {
  await requireRole(["head_academics", "super_admin"]);
  const [allDepts, schoolClasses, teachers, sessions] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name, code: departments.code, flagEmoji: departments.flagEmoji })
      .from(departments)
      .where(eq(departments.isLanguage, true))
      .orderBy(asc(departments.name)),
    db.select({ id: classes.id, name: classes.name, departmentId: classes.departmentId }).from(classes).orderBy(asc(classes.name)),
    db.select({ id: users.id, name: users.displayName }).from(users).where(or(eq(users.role, "teacher"), eq(users.role, "head_academics"))),
    db
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
      .where(gt(timetableSessions.endsAt, new Date()))
      .orderBy(asc(timetableSessions.startsAt))
      .limit(100),
  ]);

  const teacherOptions = teachers.map((t) => ({ id: t.id, name: t.name || "Teacher" }));

  return (
    <PortalShell title="Academic Timetable" nav={nav}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div>
          <h1 className="display-font text-3xl font-bold">Academic Timetable</h1>
          <p className="text-sm opacity-70">Schedule language classes and manage Google Meet live links across all departments.</p>
        </div>
        <Link
          href="/hoc/live-classes"
          className="inline-flex items-center gap-2 rounded-xl bg-red-600/80 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 shadow"
        >
          <span>🎥</span>
          <span>Open Live Classes Hub</span>
        </Link>
      </div>

      <GlassCard className="mb-5 p-6" strong>
        <h2 className="mb-2 font-semibold">Schedule a Live Class with Google Meet</h2>
        <p className="mb-4 text-sm opacity-70">
          Filter by language department, pick a class, generate or enter a Google Meet URL, and sync to Google Calendar.
        </p>
        <AdminSessionCreate
          departments={allDepts}
          classes={schoolClasses}
          teachers={teacherOptions}
        />
      </GlassCard>

      <div className="grid gap-3">
        {sessions.length ? (
          sessions.map((session) => {
            const isLive = Boolean(session.liveStartedAt && !session.liveEndedAt);
            return (
              <GlassCard
                key={session.id}
                className={`flex flex-wrap items-center justify-between gap-4 p-5 border ${
                  isLive ? "border-emerald-500 bg-emerald-950/20 shadow-md" : "border-white/10"
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
                        LIVE NOW
                      </span>
                    )}
                  </div>
                  <h2 className="font-semibold text-lg">{session.title}</h2>
                  <p className="text-sm opacity-70">
                    {session.className ?? "Open Department Session"} · {session.startsAt.toLocaleString()} –{" "}
                    {session.endsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {session.room ? ` · ${session.room}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {session.hasMeeting ? (
                    <a
                      href={`/api/portal/sessions/${session.id}/join`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90"
                    >
                      🎥 {isLive ? "Join Live Meet" : "Join Class"}
                    </a>
                  ) : (
                    <span className="text-xs opacity-60">Meeting link not set</span>
                  )}
                </div>
              </GlassCard>
            );
          })
        ) : (
          <GlassCard className="p-5 text-sm opacity-70">No upcoming sessions scheduled.</GlassCard>
        )}
      </div>
    </PortalShell>
  );
}
