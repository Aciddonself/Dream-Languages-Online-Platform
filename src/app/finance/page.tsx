import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard, Badge } from "@/components/ui/glass";
import Link from "next/link";
import { db } from "@/db";
import { feeSchedules, holds, payments } from "@/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";

const nav = [
  { href: "/finance", label: "Dashboard", icon: "🏠" },
  { href: "/finance/payments", label: "Payments", icon: "💳" },
  { href: "/finance/holds", label: "Holds", icon: "⏸️" },
  { href: "/finance/reports", label: "Reports", icon: "📊" },
];

export default async function FinanceDashboard() {
  await requireRole(["finance", "super_admin"]);
  const [collected, outstanding, holdCount, pendingCount, recentPayments] = await Promise.all([
    db.select({ currency: payments.currency, amount: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(eq(payments.status, "verified")).groupBy(payments.currency),
    db.select({ currency: feeSchedules.currency, amount: sql<number>`coalesce(sum(${feeSchedules.amount} - ${feeSchedules.paid}), 0)` }).from(feeSchedules).groupBy(feeSchedules.currency),
    db.select({ total: count() }).from(holds).where(eq(holds.status, "active")),
    db.select({ total: count() }).from(payments).where(eq(payments.status, "pending")),
    db.select().from(payments).orderBy(desc(payments.createdAt)).limit(5),
  ]);
  return (
    <PortalShell title="Finance" nav={nav}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="display-font text-3xl font-bold">Finance Dashboard</h1>
          <p className="text-sm opacity-60">Collections, holds and reconciliations.</p>
        </div>
        <Link href="/finance/payments" className="btn-glass btn-glass-primary inline-flex items-center px-4 py-2">Review payments</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <GlassCard className="p-5"><div className="text-xs font-semibold opacity-60 uppercase">Verified collections</div><div className="mt-2 space-y-1 text-lg font-bold text-[var(--success)]">{collected.length ? collected.map((item) => <div key={item.currency}>{item.currency} {Number(item.amount).toLocaleString()}</div>) : <div>None yet</div>}</div></GlassCard>
        <GlassCard className="p-5"><div className="text-xs font-semibold opacity-60 uppercase">Outstanding</div><div className="mt-2 space-y-1 text-lg font-bold text-[var(--danger)]">{outstanding.length ? outstanding.map((item) => <div key={item.currency}>{item.currency} {Number(item.amount).toLocaleString()}</div>) : <div>None</div>}</div></GlassCard>
        <GlassCard className="p-5"><div className="text-xs font-semibold opacity-60 uppercase">Active holds</div><div className="text-3xl font-bold text-[var(--warning)] mt-1">{holdCount[0]?.total ?? 0}</div><div className="text-xs opacity-60">students</div></GlassCard>
        <GlassCard className="p-5"><div className="text-xs font-semibold opacity-60 uppercase">Pending verification</div><div className="text-3xl font-bold text-[var(--brand-accent)] mt-1">{pendingCount[0]?.total ?? 0}</div><div className="text-xs opacity-60">payments</div></GlassCard>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <GlassCard className="p-5">
          <div className="font-semibold mb-3">Payment Verification Queue</div>
          <ul className="space-y-2 text-sm">
            {recentPayments.length ? recentPayments.map((payment) => (
              <li key={payment.id} className="glass px-3 py-2 flex items-center justify-between gap-3">
                <span>{payment.currency} {payment.amount.toLocaleString()} · {payment.method} · {payment.createdAt.toLocaleDateString()}</span>
                <Badge tone={payment.status === "verified" ? "success" : payment.status === "rejected" ? "danger" : "warning"}>{payment.status}</Badge>
              </li>
            )) : <li className="glass px-3 py-2">No payments have been recorded.</li>}
          </ul>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="font-semibold mb-3">Official Payment Details</div>
          <div className="text-sm space-y-1 opacity-80 glass p-3">
            <div>Account name: Dream Languages And Adult Literacy Uganda Limited</div>
            <div>Bank accounts: 3100104612, 3100112636</div>
            <div>MTN MoMo merchant: 588449</div>
            <div>Airtel Money merchant: 4365181</div>
          </div>
          <Link href="/finance/holds" className="mt-4 inline-flex text-sm font-semibold hover:underline">Review active holds →</Link>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="font-semibold mb-3">Quick Actions</div>
        <div className="flex flex-wrap gap-3">
          <Link href="/finance/payments" className="btn-glass inline-flex px-4 py-2">Payment records</Link>
          <Link href="/finance/reports" className="btn-glass inline-flex px-4 py-2">Debtors report</Link>
        </div>
      </GlassCard>
    </PortalShell>
  );
}