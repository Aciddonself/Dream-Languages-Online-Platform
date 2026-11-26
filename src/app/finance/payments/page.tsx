import { and, asc, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { db } from "@/db";
import { departments, feeSchedules, payments, users } from "@/db/schema";
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
  const studentRows = await db.select({
    id: users.id, name: users.displayName, firstName: users.firstName, lastName: users.lastName,
    email: users.email, registrationNumber: users.registrationNumber, department: departments.name,
    amount: feeSchedules.amount, paid: feeSchedules.paid, currency: feeSchedules.currency,
  }).from(users).leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(feeSchedules, eq(feeSchedules.studentId, users.id))
    .where(and(eq(users.role, "student"), isNull(users.deletedAt))).orderBy(asc(departments.name), asc(users.displayName)).limit(2000);
  const studentMap = new Map<string, { id: string; name: string; registrationNumber: string | null; department: string | null; balances: Map<string, number> }>();
  for (const row of studentRows) {
    const current = studentMap.get(row.id) ?? {
      id: row.id,
      name: row.name || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email,
      registrationNumber: row.registrationNumber,
      department: row.department,
      balances: new Map<string, number>(),
    };
    if (row.amount !== null && row.paid !== null && row.currency && row.amount > row.paid) {
      current.balances.set(row.currency, (current.balances.get(row.currency) ?? 0) + row.amount - row.paid);
    }
    studentMap.set(row.id, current);
  }
  const manualPaymentStudents = [...studentMap.values()].map((student) => ({ ...student, balances: [...student.balances].map(([currency, amount]) => ({ currency, amount })) })).filter((student) => student.balances.length > 0);

  return <PortalShell title="Payment Verification" nav={nav}>
    <h1 className="display-font mb-2 text-3xl font-bold">Payment Verification</h1>
    <p className="mb-5 text-sm opacity-70">Verify reported transfers to credit the student&apos;s fee balance, or reject them with a reason.</p>
    <div className="mb-6"><FinanceManualPaymentForm students={manualPaymentStudents} /></div>
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
