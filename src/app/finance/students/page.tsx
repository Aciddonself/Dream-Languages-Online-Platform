import Link from "next/link";
import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { departments, feeSchedules, users } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/finance", label: "Dashboard", icon: "🏠" },
  { href: "/finance/payments", label: "Payments", icon: "💳" },
  { href: "/finance/students", label: "Students by language", icon: "👥" },
  { href: "/finance/holds", label: "Holds", icon: "⏸️" },
  { href: "/finance/reports", label: "Reports", icon: "📊" },
];

export default async function FinanceStudentsPage({ searchParams }: { searchParams: Promise<{ departmentId?: string; q?: string }> }) {
  await requireRole(["finance", "super_admin"]);
  const { departmentId = "", q = "" } = await searchParams;
  const term = q.trim().slice(0, 80);
  const languageDepartments = await db.select({ id: departments.id, name: departments.name }).from(departments)
    .where(and(eq(departments.isLanguage, true), isNull(departments.deletedAt))).orderBy(asc(departments.name));
  const rows = await db.select({
    id: feeSchedules.id,
    studentId: users.id,
    name: users.displayName,
    email: users.email,
    registrationNumber: users.registrationNumber,
    departmentName: departments.name,
    amount: feeSchedules.amount,
    paid: feeSchedules.paid,
    currency: feeSchedules.currency,
    dueDate: feeSchedules.dueDate,
    status: feeSchedules.status,
  }).from(feeSchedules)
    .innerJoin(users, eq(feeSchedules.studentId, users.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(
      eq(users.role, "student"),
      isNull(users.deletedAt),
      departmentId === "unassigned" ? isNull(users.departmentId) : departmentId ? eq(users.departmentId, departmentId) : undefined,
      term ? or(ilike(users.displayName, `%${term}%`), ilike(users.email, `%${term}%`), ilike(users.registrationNumber, `%${term}%`)) : undefined,
    ))
    .orderBy(asc(departments.name), asc(users.displayName), desc(feeSchedules.createdAt)).limit(500);

  return <PortalShell title="Students by language" nav={nav}>
    <h1 className="display-font mb-2 text-3xl font-bold">Students by language department</h1>
    <p className="mb-5 text-sm opacity-70">Find each student’s language group and review their fee balance. Each row represents a fee schedule.</p>
    <form method="get" className="mb-5 flex flex-wrap gap-2">
      <input name="q" defaultValue={term} placeholder="Search name, email or registration number" className="glass min-w-56 flex-1 px-4 py-2.5" />
      <select name="departmentId" defaultValue={departmentId} className="glass min-w-56 px-3 py-2.5">
        <option value="">All language departments</option>
        <option value="unassigned">Department unassigned</option>
        {languageDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
      </select>
      <button type="submit" className="glass rounded-xl px-4 py-2.5 font-semibold">Filter students</button>
      {(term || departmentId) && <Link href="/finance/students" className="glass rounded-xl px-4 py-2.5">Clear</Link>}
    </form>
    <div className="grid gap-3">
      {rows.length ? rows.map((row) => <GlassCard key={row.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <h2 className="font-semibold">{row.name ?? "Student"} <span className="font-mono text-xs opacity-60">{row.registrationNumber ?? "No registration number"}</span></h2>
          <p className="text-sm opacity-70">{row.departmentName ?? "Department unassigned"} · {row.email}</p>
          <p className="text-sm">{row.currency} {row.paid.toLocaleString()} paid of {row.amount.toLocaleString()} · Due {row.dueDate ?? "not set"}</p>
        </div>
        <span className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-semibold">{row.status}</span>
      </GlassCard>) : <GlassCard className="p-5 text-sm opacity-70">No fee schedules match this search.</GlassCard>}
    </div>
  </PortalShell>;
}
