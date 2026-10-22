import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard, GlassButton } from "@/components/ui/glass";
import { AdminSessionCreate } from "@/components/admin-session-create";
import Link from "next/link";
import { db } from "@/db";
import { classes, enrolments, exams, timetableSessions } from "@/db/schema";
import { and, count, eq, gt, inArray } from "drizzle-orm";

const nav = [
  { href: "/teacher", label: "Dashboard", icon: "🏠" },
  { href: "/teacher/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/teacher/classes", label: "My Classes", icon: "📚" },
  { href: "/teacher/attendance", label: "Attendance", icon: "✅" },
  { href: "/teacher/materials", label: "Materials", icon: "📄" },
  { href: "/teacher/exams", label: "Exams", icon: "📝" },
  { href: "/teacher/community", label: "Class discussions", icon: "💬" },
  { href: "/teacher/live", label: "Live Classes", icon: "🎥" },
];

export default async function TeacherDashboard() {
  const user = await requireRole(["teacher", "head_academics", "super_admin"]);
  const teacherClasses = await db.select().from(classes).where(eq(classes.teacherId, user.id));
  const classIds = teacherClasses.map((schoolClass) => schoolClass.id);
  const [studentCount, pendingExams, upcomingSessions] = await Promise.all([
    classIds.length
      ? db.select({ total: count() }).from(enrolments).where(inArray(enrolments.classId, classIds))
      : Promise.resolve([{ total: 0 }]),
    db.select({ total: count() }).from(exams).where(and(eq(exams.teacherId, user.id), eq(exams.published, false))),
    db.select().from(timetableSessions).where(and(eq(timetableSessions.teacherId, user.id), gt(timetableSessions.startsAt, new Date()))).orderBy(timetableSessions.startsAt).limit(5),
  ]);
  return (
    <PortalShell title="Teacher Portal" nav={nav}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="display-font text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-sm opacity-60">Your classes and tasks at a glance.</p>
        </div>
        <a className="btn-glass btn-glass-primary inline-flex items-center px-4 py-2" href="https://meet.google.com/new" target="_blank" rel="noreferrer">Start live class</a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <GlassCard className="p-5"><div className="text-xs font-semibold opacity-60 uppercase">My Classes</div><div className="text-3xl font-bold text-[var(--brand-primary)] mt-1">{teacherClasses.length}</div></GlassCard>
        <GlassCard className="p-5"><div className="text-xs font-semibold opacity-60 uppercase">Students</div><div className="text-3xl font-bold text-[var(--brand-accent)] mt-1">{studentCount[0]?.total ?? 0}</div></GlassCard>
        <GlassCard className="p-5"><div className="text-xs font-semibold opacity-60 uppercase">Exams to Review</div><div className="text-3xl font-bold text-[var(--warning)] mt-1">{pendingExams[0]?.total ?? 0}</div></GlassCard>
        <GlassCard className="p-5"><div className="text-xs font-semibold opacity-60 uppercase">Upcoming Sessions</div><div className="text-3xl font-bold text-[var(--success)] mt-1">{upcomingSessions.length}</div></GlassCard>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <GlassCard className="p-5">
          <div className="font-semibold mb-3">My Classes</div>
          <ul className="space-y-2 text-sm">
            {teacherClasses.length ? teacherClasses.map((schoolClass) => (
              <li key={schoolClass.id} className="glass px-3 py-2 flex items-center justify-between">
                <span>{schoolClass.name}</span>
                <Link href="/teacher/classes" className="text-xs font-semibold hover:underline">Open</Link>
              </li>
            )) : <li className="glass px-3 py-2">No classes are assigned to your account yet.</li>}
          </ul>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="font-semibold mb-3">Upcoming Sessions</div>
          <ul className="space-y-2 text-sm">
            {upcomingSessions.length ? upcomingSessions.map((session) => (
              <li key={session.id} className="glass px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <span>{session.startsAt.toLocaleString()} · {session.title}</span>
                {session.meetUrl && <a href={`/api/portal/sessions/${session.id}/join`} className="font-semibold hover:underline">Join Meet</a>}
              </li>
            )) : <li className="glass px-3 py-2">No upcoming sessions are scheduled.</li>}
          </ul>
          <div className="mt-4">
            <GlassButton variant="glass" className="w-full">Take Attendance</GlassButton>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="font-semibold mb-3">Quick Actions</div>
        <div className="flex flex-wrap gap-3">
          <GlassButton variant="glass">Upload Material</GlassButton>
          <GlassButton variant="glass">Create Exam</GlassButton>
          <GlassButton variant="glass">Mark Submissions</GlassButton>
          <GlassButton variant="glass">Publish Results</GlassButton>
        </div>
      </GlassCard>
      <GlassCard className="mt-6 p-6" strong>
        <h2 className="mb-2 font-semibold">Schedule a class or meeting</h2>
        <p className="mb-4 text-sm opacity-70">Schedule a session for one of your assigned classes and add its Google Meet URL for enrolled students.</p>
        <AdminSessionCreate classes={teacherClasses.map(({ id, name }) => ({ id, name }))} />
      </GlassCard>
    </PortalShell>
  );
}