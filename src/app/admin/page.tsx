import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard, GlassButton, Badge } from "@/components/ui/glass";
import { db } from "@/db";
import { users, departments } from "@/db/schema";
import { count, eq } from "drizzle-orm";

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
  const [studentCount] = await db.select({ c: count() }).from(users).where(eq(users.role, "student"));
  const [teacherCount] = await db.select({ c: count() }).from(users).where(eq(users.role, "teacher"));
  const [applicantCount] = await db.select({ c: count() }).from(users).where(eq(users.role, "applicant"));
  const [financeCount] = await db.select({ c: count() }).from(users).where(eq(users.role, "finance"));
  const depts = await db.select().from(departments);

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
        {/* Chart placeholder */}
        <GlassCard className="p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">Enrolment Overview</div>
            <Badge tone="info">This term</Badge>
          </div>
          <div className="flex items-end gap-2 h-40">
            {[40, 65, 50, 80, 55, 90, 70, 85, 60, 75, 95, 88].map((v, i) => (
              <div key={i} className="dashboard-chart-bar flex-1 rounded-t-md" style={{ height: `${v}%`, animationDelay: `${i * 35}ms`, background: "linear-gradient(180deg, var(--brand-primary), var(--brand-accent))" }} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] opacity-50 mt-2">
            {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m) => <span key={m}>{m}</span>)}
          </div>
        </GlassCard>

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
          {depts.map((d) => (
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