import { and, asc, eq, gt } from "drizzle-orm";
import { requireRole } from "@/lib/rbac";
import { db } from "@/db";
import { classes, timetableSessions } from "@/db/schema";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";

const nav = [
  { href: "/teacher", label: "Dashboard", icon: "🏠" },
  { href: "/teacher/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/teacher/attendance", label: "Attendance", icon: "✅" },
  { href: "/teacher/exams", label: "Exams", icon: "📝" },
];

export const dynamic = "force-dynamic";

export default async function TeacherTimetablePage() {
  const user = await requireRole(["teacher", "head_academics", "super_admin"]);
  const sessions = await db.select({
    id: timetableSessions.id,
    title: timetableSessions.title,
    startsAt: timetableSessions.startsAt,
    endsAt: timetableSessions.endsAt,
    room: timetableSessions.room,
    className: classes.name,
    hasMeeting: timetableSessions.meetUrl,
  }).from(timetableSessions).leftJoin(classes, eq(timetableSessions.classId, classes.id))
    .where(and(eq(timetableSessions.teacherId, user.id), gt(timetableSessions.endsAt, new Date())))
    .orderBy(asc(timetableSessions.startsAt)).limit(100);
  return (
    <PortalShell title="Teacher Timetable" nav={nav}>
      <h1 className="display-font mb-2 text-3xl font-bold">My teaching timetable</h1>
      <p className="mb-5 text-sm opacity-70">Upcoming sessions scheduled by the Head of Academics or your class team.</p>
      <div className="grid gap-3">
        {sessions.length ? sessions.map((session) => (
          <GlassCard key={session.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div><h2 className="font-semibold">{session.title}</h2><p className="text-sm opacity-70">{session.className ?? "School session"} · {session.startsAt.toLocaleString()} – {session.endsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{session.room ? ` · ${session.room}` : ""}</p></div>
            {session.hasMeeting ? <a href={`/api/portal/sessions/${session.id}/join`} className="btn-glass btn-glass-primary rounded-xl px-4 py-2 font-semibold">Join class</a> : <span className="text-sm opacity-60">Meeting not yet available</span>}
          </GlassCard>
        )) : <GlassCard className="p-5 text-sm opacity-70">No upcoming sessions are assigned to you.</GlassCard>}
      </div>
    </PortalShell>
  );
}
