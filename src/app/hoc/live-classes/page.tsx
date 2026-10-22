import { asc, desc, eq, gt, or, isNotNull, and } from "drizzle-orm";
import { requireRole } from "@/lib/rbac";
import { db } from "@/db";
import { classes, departments, timetableSessions, users } from "@/db/schema";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { AdminSessionCreate } from "@/components/admin-session-create";
import { LiveClassController, type LiveSessionItem } from "@/components/live-class-controller";

const nav = [
  { href: "/hoc", label: "Dashboard", icon: "🏠" },
  { href: "/hoc/live-classes", label: "Live Classes", icon: "🎥" },
  { href: "/hoc/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/hoc/community", label: "Class discussions", icon: "💬" },
];

export const dynamic = "force-dynamic";

export default async function HocLiveClassesPage() {
  await requireRole(["head_academics", "super_admin"]);

  // Fetch departments, classes, teachers, and sessions
  const [allDepts, schoolClasses, teachers, rawSessions] = await Promise.all([
    db
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
        flagEmoji: departments.flagEmoji,
        isLanguage: departments.isLanguage,
      })
      .from(departments)
      .where(eq(departments.isLanguage, true))
      .orderBy(asc(departments.name)),
    db
      .select({
        id: classes.id,
        name: classes.name,
        departmentId: classes.departmentId,
      })
      .from(classes)
      .orderBy(asc(classes.name)),
    db
      .select({
        id: users.id,
        name: users.displayName,
      })
      .from(users)
      .where(or(eq(users.role, "teacher"), eq(users.role, "head_academics")))
      .orderBy(asc(users.displayName)),
    db
      .select({
        id: timetableSessions.id,
        title: timetableSessions.title,
        startsAt: timetableSessions.startsAt,
        endsAt: timetableSessions.endsAt,
        room: timetableSessions.room,
        meetUrl: timetableSessions.meetUrl,
        liveStartedAt: timetableSessions.liveStartedAt,
        liveEndedAt: timetableSessions.liveEndedAt,
        className: classes.name,
        departmentName: departments.name,
        departmentCode: departments.code,
        flagEmoji: departments.flagEmoji,
        teacherName: users.displayName,
      })
      .from(timetableSessions)
      .leftJoin(classes, eq(timetableSessions.classId, classes.id))
      .leftJoin(departments, eq(classes.departmentId, departments.id))
      .leftJoin(users, eq(timetableSessions.teacherId, users.id))
      // eslint-disable-next-line react-hooks/purity
      .where(gt(timetableSessions.endsAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .orderBy(asc(timetableSessions.startsAt))
      .limit(100),
  ]);

  const teacherOptions = teachers.map((t) => ({
    id: t.id,
    name: t.name || "Staff Member",
  }));

  const sessionItems: LiveSessionItem[] = rawSessions.map((s) => ({
    id: s.id,
    title: s.title,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    room: s.room,
    meetUrl: s.meetUrl,
    className: s.className,
    departmentName: s.departmentName ?? "Department-Wide",
    departmentCode: s.departmentCode,
    flagEmoji: s.flagEmoji,
    teacherName: s.teacherName,
    liveStartedAt: s.liveStartedAt,
    liveEndedAt: s.liveEndedAt,
  }));

  const liveNowCount = sessionItems.filter((s) => Boolean(s.liveStartedAt && !s.liveEndedAt)).length;
  const upcomingCount = sessionItems.filter((s) => !s.liveStartedAt && new Date(s.endsAt) > new Date()).length;

  return (
    <PortalShell title="Live Classes Hub" nav={nav}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600/20 text-red-400 font-bold">
              🎥
            </span>
            <h1 className="display-font text-3xl font-bold">Live Classes with Google Meet</h1>
          </div>
          <p className="text-sm opacity-70 mt-1">
            Head of Languages/Department scheduling and live session command center.
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <GlassCard className="p-4 border-l-4 border-emerald-500">
          <div className="text-xs font-semibold opacity-60 uppercase">Live Right Now</div>
          <div className="text-3xl font-bold text-emerald-400 mt-1 flex items-center gap-2">
            {liveNowCount}
            {liveNowCount > 0 && <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />}
          </div>
          <div className="text-xs opacity-60 mt-1">Active Google Meet rooms</div>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-blue-500">
          <div className="text-xs font-semibold opacity-60 uppercase">Upcoming Sessions</div>
          <div className="text-3xl font-bold text-[var(--brand-primary)] mt-1">{upcomingCount}</div>
          <div className="text-xs opacity-60 mt-1">Scheduled next</div>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-amber-500">
          <div className="text-xs font-semibold opacity-60 uppercase">Language Departments</div>
          <div className="text-3xl font-bold text-amber-400 mt-1">{allDepts.length}</div>
          <div className="text-xs opacity-60 mt-1">French, German, Swahili, etc.</div>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-purple-500">
          <div className="text-xs font-semibold opacity-60 uppercase">Active Classes</div>
          <div className="text-3xl font-bold text-purple-400 mt-1">{schoolClasses.length}</div>
          <div className="text-xs opacity-60 mt-1">Across all language levels</div>
        </GlassCard>
      </div>

      {/* Schedule Form */}
      <GlassCard className="mb-6 p-6" strong>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-xl">📅</span>
          <h2 className="text-lg font-bold text-white">Schedule New Live Class</h2>
        </div>
        <p className="mb-5 text-sm opacity-70">
          Select a language department and class, click <strong>Generate Google Meet Link</strong> to create an instant meeting room, and publish it to the student timetable.
        </p>

        <AdminSessionCreate
          departments={allDepts}
          classes={schoolClasses}
          teachers={teacherOptions}
        />
      </GlassCard>

      {/* Live Class Command Center */}
      <GlassCard className="p-6" strong>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Department Live Classes & Timetable</h2>
            <p className="text-xs opacity-70">
              Filter by language, start sessions, launch Google Meet, or copy invitation links for learners.
            </p>
          </div>
        </div>

        <LiveClassController sessions={sessionItems} canManage={true} />
      </GlassCard>
    </PortalShell>
  );
}
