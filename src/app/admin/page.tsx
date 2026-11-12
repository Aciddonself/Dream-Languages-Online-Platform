import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard, GlassButton, Badge } from "@/components/ui/glass";
import { db } from "@/db";
import { auditLogs, users, departments } from "@/db/schema";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { formatSchoolDateTime } from "@/lib/school-time";
import { MailAccessCard } from "@/components/mail-access-card";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/calendar", label: "Calendar", icon: "🗓️" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/volunteers", label: "Teacher applications", icon: "🧑‍🏫" },
  { href: "/admin/academic", label: "Academic", icon: "🎓" },
  { href: "/admin/cms", label: "CMS", icon: "📝" },
  { href: "/admin/sms", label: "Bulk SMS", icon: "✉️" },
  { href: "/admin/finance", label: "Finance", icon: "💰" },
  { href: "/admin/incidents", label: "Incidents", icon: "🛡️" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default async function AdminDashboard() {
  await requireRole(["super_admin"]);
  const monthWindowStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11, 1));
  const [[studentCount], [teacherCount], [applicantCount], [financeCount], depts, monthlyStudentRows, recentActivity] = await Promise.all([
    db.select({ c: count() }).from(users).where(eq(users.role, "student")),
    db.select({ c: count() }).from(users).where(eq(users.role, "teacher")),
    db.select({ c: count() }).from(users).where(eq(users.role, "applicant")),
    db.select({ c: count() }).from(users).where(eq(users.role, "finance")),
    db.select().from(departments),
    db.select({ month: sql<string>`to_char(${users.createdAt}, 'YYYY-MM')`, total: count() })
      .from(users)
      .where(and(eq(users.role, "student"), gte(users.createdAt, monthWindowStart)))
      .groupBy(sql`to_char(${users.createdAt}, 'YYYY-MM')`),
    db.select({ action: auditLogs.action, entityType: auditLogs.entityType, createdAt: auditLogs.createdAt, actorName: users.displayName })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(5),
  ]);

  const monthlyStudentCounts = new Map(monthlyStudentRows.map(({ month, total }) => [month, total]));
  const monthlyStudentAccounts = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11 + index, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const total = monthlyStudentCounts.get(monthKey) ?? 0;
    return { label: new Intl.DateTimeFormat("en-UG", { month: "short", timeZone: "Africa/Kampala" }).format(date), total };
  });
  const peakMonthlyAccounts = Math.max(1, ...monthlyStudentAccounts.map((item) => item.total));

  const stats = [
    { label: "Total Students", value: studentCount.c, color: "var(--brand-primary)" },
    { label: "Teachers", value: teacherCount.c, color: "var(--brand-accent)" },
    { label: "Applicants", value: applicantCount.c, color: "var(--warning)" },
    { label: "Finance Staff", value: financeCount.c, color: "var(--success)" },
  ];

  return (
    <PortalShell title="Admin Console" nav={nav}>
      <MailAccessCard />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="display-font text-3xl font-bold">Dashboard</h1>
          <p className="text-sm opacity-60">Welcome back, Admin. Here&apos;s what&apos;s happening.</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-glass inline-flex items-center px-4 py-2" href="/api/admin/users/export">Export users</Link>
          <Link className="btn-glass btn-glass-primary inline-flex items-center px-4 py-2" href="/admin/users">Create user</Link>
        </div>
      </div>

      {/* Stat cards (Edutera-style) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <GlassCard key={s.label} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold opacity-60 uppercase tracking-wider">{s.label}</span>
            </div>
            <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <GlassCard className="p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">New student accounts</div>
            <Badge tone="info">Last 12 months</Badge>
          </div>
          <div className="flex items-end gap-2 h-40">
            {monthlyStudentAccounts.map((item, i) => (
              <div key={item.label} className="dashboard-chart-bar flex-1 rounded-t-md" title={`${item.label}: ${item.total} student accounts`} style={{ height: `${Math.max(4, item.total / peakMonthlyAccounts * 100)}%`, animationDelay: `${i * 35}ms`, background: "linear-gradient(180deg, var(--brand-primary), var(--brand-accent))" }} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] opacity-50 mt-2">
            {monthlyStudentAccounts.map((item) => <span key={item.label}>{item.label}</span>)}
          </div>
        </GlassCard>

        {/* Recent activity */}
        <GlassCard className="p-5">
          <div className="font-semibold mb-3">Recent Activity</div>
          <ul className="space-y-3 text-sm">
            {recentActivity.length ? recentActivity.map((item) => (
              <li key={`${item.action}-${item.createdAt.toISOString()}`} className="flex items-start gap-2">
                <span className="mt-1 w-2 h-2 rounded-full bg-[var(--brand-primary)] shrink-0" />
                <div>
                  <div className="capitalize">{item.action.replaceAll("_", " ")} · {item.entityType}</div>
                  <div className="text-xs opacity-50">{item.actorName ?? "System"} · {formatSchoolDateTime(item.createdAt)}</div>
                </div>
              </li>
            )) : <li className="text-sm opacity-60">No audited activity has been recorded yet.</li>}
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
          <Link href="/admin/users" className="btn-glass btn-glass-primary inline-flex items-center px-4 py-2">Create User</Link>
          <Link href="/admin/cms" className="btn-glass inline-flex items-center px-4 py-2">New Announcement</Link>
          <Link href="/admin/users?role=applicant" className="btn-glass inline-flex items-center px-4 py-2">Review Applicants</Link>
          <Link href="/admin/finance" className="btn-glass inline-flex items-center px-4 py-2">Finance Overview</Link>
        </div>
      </GlassCard>
    </PortalShell>
  );
}
