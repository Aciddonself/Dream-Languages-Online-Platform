import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard, GlassButton, Badge } from "@/components/ui/glass";
import { AttendanceTrendChart } from "@/components/attendance-trend-chart";
import { db } from "@/db";
import { attendance, users, departments, timetableSessions, enrolments } from "@/db/schema";
import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import { classAttendanceTrend } from "@/lib/attendance-trends";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/calendar", label: "Calendar", icon: "🗓️" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/volunteers", label: "Teacher applications", icon: "🧑‍🏫" },
  { href: "/admin/academic", label: "Academic", icon: "🎓" },
  { href: "/admin/recordings", label: "Class recordings", icon: "🎬" },
  { href: "/admin/cms", label: "CMS", icon: "📝" },
  { href: "/admin/sms", label: "Bulk SMS", icon: "✉️" },
  { href: "/admin/finance", label: "Finance", icon: "💰" },
  { href: "/admin/incidents", label: "Incidents", icon: "🛡️" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default async function AdminDashboard() {
  await requireRole(["super_admin"]);
  const [[studentCount], [teacherCount], [applicantCount], [financeCount], depts] = await Promise.all([
    db.select({ c: count() }).from(users).where(eq(users.role, "student")),
    db.select({ c: count() }).from(users).where(eq(users.role, "teacher")),
    db.select({ c: count() }).from(users).where(eq(users.role, "applicant")),
    db.select({ c: count() }).from(users).where(eq(users.role, "finance")),
    db.select().from(departments),
  ]);
  const completedSessions = await db.select({ id: timetableSessions.id, classId: timetableSessions.classId, startsAt: timetableSessions.startsAt, endsAt: timetableSessions.endsAt })
    .from(timetableSessions).where(isNotNull(timetableSessions.liveEndedAt));
  const completedIds = completedSessions.map((session) => session.id);
  const classIds: string[] = [...new Set<string>(completedSessions.map((session: { classId: string | null }) => session.classId).filter((id: string | null): id is string => Boolean(id)))];
  const [rosterSizes, attendanceRows] = await Promise.all([
    classIds.length ? db.select({ classId: enrolments.classId, students: count() }).from(enrolments).where(and(inArray(enrolments.classId, classIds), eq(enrolments.status, "active"))).groupBy(enrolments.classId) : Promise.resolve([] as Array<{ classId: string; students: number }>),
    completedIds.length ? db.select({ sessionId: attendance.sessionId, studentId: attendance.studentId, status: attendance.status, checkInAt: attendance.checkInAt, checkOutAt: attendance.checkOutAt }).from(attendance).where(inArray(attendance.sessionId, completedIds)) : Promise.resolve([]),
  ]);
  const studentsByClass = new Map<string, number>(rosterSizes.map((row) => [row.classId, row.students]));
  const enrollmentBySession = new Map<string, number>(completedSessions.map((session) => [session.id, session.classId ? studentsByClass.get(session.classId) ?? 0 : 0]));
  const attendanceMonths = classAttendanceTrend(completedSessions, attendanceRows, enrollmentBySession);

  const stats = [
    { label: "Total Students", value: studentCount.c, color: "var(--brand-primary)", trend: "+12%" },
    { label: "Teachers", value: teacherCount.c, color: "var(--brand-accent)", trend: "+3" },
    { label: "Applicants", value: applicantCount.c, color: "var(--warning)", trend: "+8" },
    { label: "Finance Staff", value: financeCount.c, color: "var(--success)", trend: "0" },
  ];

  return (
    <PortalShell title="Admin Console" nav={nav}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="display-font text-3xl font-bold">Dashboard</h1>
          <p className="text-sm opacity-60">Welcome back, Admin. Here&apos;s what&apos;s happening.</p>
        </div>
        <div className="flex gap-2">
          <GlassButton variant="glass">Export</GlassButton>
          <GlassButton>Create New</GlassButton>
        </div>
      </div>

      {/* Stat cards (Edutera-style) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <GlassCard key={s.label} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold opacity-60 uppercase tracking-wider">{s.label}</span>
              <span className="text-xs font-semibold" style={{ color: s.color }}>{s.trend}</span>
            </div>
            <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="mt-3 progress-tube"><span style={{ width: "60%" }} /></div>
          </GlassCard>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2"><AttendanceTrendChart title="School attendance" months={attendanceMonths} /></div>

        {/* Recent activity */}
        <GlassCard className="p-5">
          <div className="font-semibold mb-3">Recent Activity</div>
          <ul className="space-y-3 text-sm">
            {[
              { t: "New applicant registered", d: "2 min ago" },
              { t: "Payment verified", d: "15 min ago" },
              { t: "Exam published", d: "1 hr ago" },
              { t: "Student placed on hold", d: "2 hr ago" },
              { t: "Dead period approved", d: "3 hr ago" },
            ].map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 w-2 h-2 rounded-full bg-[var(--brand-primary)] shrink-0" />
                <div>
                  <div>{a.t}</div>
                  <div className="text-xs opacity-50">{a.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {/* Departments grid */}
      <GlassCard className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold">Language Departments</div>
          <Link href="/admin/academic">
            <GlassButton variant="glass" className="text-xs">Manage Academic Structure →</GlassButton>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {depts.map((d: { id: string; code: string; flagEmoji?: string | null; name: string }) => (
            <a key={d.id} href={`/departments/${d.code.toLowerCase()}`} className="glass p-3 text-center block hover:opacity-80 transition-opacity">
              <div className="text-2xl">{d.flagEmoji ?? "🌐"}</div>
              <div className="text-xs font-medium mt-1">{d.name}</div>
            </a>
          ))}
        </div>
      </GlassCard>

      {/* Quick actions */}
      <GlassCard className="p-6">
        <div className="font-semibold mb-3">Quick Actions</div>
        <div className="flex flex-wrap gap-3">
          <GlassButton>Create User</GlassButton>
          <GlassButton variant="glass">New Announcement</GlassButton>
          <GlassButton variant="glass">Import CSV</GlassButton>
          <GlassButton variant="glass">Run Reports</GlassButton>
        </div>
      </GlassCard>
    </PortalShell>
  );
}
