import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { db } from "@/db";
import { departments, payments, users } from "@/db/schema";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { PaymentReviewControls } from "@/components/payment-review-controls";
import { FinanceManualPaymentForm } from "@/components/finance-manual-payment-form";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/finance", label: "Dashboard", icon: "🏠" },
  { href: "/finance/payments", label: "Payments", icon: "💳" },
  { href: "/finance/holds", label: "Holds", icon: "⏸️" },
  { href: "/finance/reports", label: "Reports", icon: "📊" },
];

export default async function FinancePaymentsPage({ searchParams }: { searchParams: Promise<{ departmentId?: string }> }) {
  await requireRole(["finance", "admin", "super_admin"]);
  const { departmentId = "" } = await searchParams;
  const languageDepartments = await db.select({ id: departments.id, name: departments.name }).from(departments)
    .where(and(eq(departments.isLanguage, true), isNull(departments.deletedAt))).orderBy(asc(departments.name));
  const rows = await db.select({
    id: payments.id, studentId: payments.studentId, amount: payments.amount, currency: payments.currency,
    method: payments.method, reference: payments.reference, status: payments.status, createdAt: payments.createdAt,
    name: users.displayName, firstName: users.firstName, lastName: users.lastName, email: users.email, registrationNumber: users.registrationNumber,
    departmentName: departments.name,
  }).from(payments).leftJoin(users, eq(payments.studentId, users.id)).leftJoin(departments, eq(users.departmentId, departments.id))
    .where(departmentId === "unassigned" ? isNull(users.departmentId) : departmentId ? eq(users.departmentId, departmentId) : undefined).orderBy(desc(payments.createdAt)).limit(250);
  const departmentCollections = await db.select({
    departmentId: departments.id,
    departmentName: departments.name,
    currency: payments.currency,
    amount: sql<number>`coalesce(sum(${payments.amount}), 0)::bigint`,
  }).from(payments)
    .innerJoin(users, eq(payments.studentId, users.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(payments.status, "verified"), or(eq(departments.isLanguage, true), isNull(departments.id))))
    .groupBy(departments.id, departments.name, payments.currency)
    .orderBy(asc(departments.name), asc(payments.currency));
  const languageTotalsByCurrency = new Map<string, number>();
  const unassignedTotalsByCurrency = new Map<string, number>();
  for (const row of departmentCollections) {
    const totals = row.departmentId ? languageTotalsByCurrency : unassignedTotalsByCurrency;
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + Number(row.amount));
  }

  return <PortalShell title="Payment Verification" nav={nav}>
    <h1 className="display-font mb-2 text-3xl font-bold">Payment Verification</h1>
    <p className="mb-5 text-sm opacity-70">Verify reported transfers to credit the student&apos;s fee balance, or reject them with a reason.</p>
    <GlassCard className="mb-6 p-5">
      <h2 className="font-semibold">Fees collected by language department</h2>
      <p className="mb-4 mt-1 text-sm opacity-65">All time totals from verified payments, including payments recorded manually and online.</p>
      {departmentCollections.length ? <>
        <div className="space-y-2">
          {departmentCollections.map((row) => <div key={`${row.departmentId ?? "unassigned"}-${row.currency}`} className="flex flex-wrap justify-between gap-2 rounded-xl border border-[var(--border)] p-3 text-sm">
            <span>{row.departmentName ?? "Department unassigned"}</span><strong>{row.currency} {Number(row.amount).toLocaleString()}</strong>
          </div>)}
        </div>
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <div className="text-xs font-semibold uppercase opacity-60">Total collected across language departments</div>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-lg font-bold text-[var(--success)]">
            {[...languageTotalsByCurrency].map(([currency, amount]) => <span key={currency}>{currency} {amount.toLocaleString()}</span>)}
          </div>
          {unassignedTotalsByCurrency.size > 0 && <p className="mt-2 text-xs opacity-65">Department unassigned: {[...unassignedTotalsByCurrency].map(([currency, amount]) => `${currency} ${amount.toLocaleString()}`).join(" · ")}. This is shown separately and is not included in the language totals.</p>}
        </div>
      </> : <p className="text-sm opacity-65">No verified payments have been collected yet.</p>}
    </GlassCard>
    <div className="mb-6"><FinanceManualPaymentForm departments={languageDepartments} /></div>
    <form method="get" className="mb-5 flex flex-wrap gap-2">
      <select name="departmentId" defaultValue={departmentId} className="glass min-w-56 px-3 py-2.5">
        <option value="">All language departments</option>
        <option value="unassigned">Department unassigned</option>
        {languageDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
      </select>
      <button type="submit" className="glass rounded-xl px-4 py-2.5 font-semibold">Filter payments</button>
      {departmentId && <Link href="/finance/payments" className="glass rounded-xl px-4 py-2.5">Clear</Link>}
    </form>
    <div className="space-y-3">
      {rows.length ? rows.map((payment) => {
        const name = payment.name || [payment.firstName, payment.lastName].filter(Boolean).join(" ") || payment.email || "Student";
        return <GlassCard className="p-4" key={payment.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-semibold">{name}{payment.registrationNumber ? ` · ${payment.registrationNumber}` : ""}</div>
              <div className="mt-1 text-sm">{payment.currency} {payment.amount.toLocaleString()} · {payment.method.replaceAll("_", " ")}</div>
              <div className="text-sm opacity-65">{payment.departmentName ?? "Department unassigned"} · Reference: {payment.reference ?? "Not supplied"} · {payment.createdAt.toLocaleString()}</div>
              {payment.status === "pending" && <div className="mt-3"><PaymentReviewControls paymentId={payment.id} /></div>}
              {payment.status === "verified" && payment.studentId && <a className="mt-3 inline-flex text-sm font-semibold underline" href={`/api/portal/documents/receipt/${payment.id}`}>Download receipt</a>}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${payment.status === "verified" ? "bg-emerald-500/15 text-emerald-800" : payment.status === "rejected" ? "bg-red-500/15 text-red-800" : "bg-amber-500/15 text-amber-800"}`}>{payment.status}</span>
          </div>
        </GlassCard>;
      }) : <GlassCard className="p-5 text-sm opacity-65">No payment records have been submitted.</GlassCard>}
    </div>
  </PortalShell>;
}
