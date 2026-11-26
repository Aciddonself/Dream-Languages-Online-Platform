import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { feeSchedules, holds, payments, settings, users } from "@/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";

const nav = [{ href: "/admin", label: "Dashboard", icon: "🏠" }, { href: "/admin/finance", label: "Finance", icon: "💰" }];

export default async function AdminFinance() {
  await requireRole(["super_admin", "admin"]);
  const [paymentsCount, pendingCount, holdCount, balances, collections, recentPayments, settingsRow] = await Promise.all([
    db.select({ total: count() }).from(payments),
    db.select({ total: count() }).from(payments).where(eq(payments.status, "pending")),
    db.select({ total: count() }).from(holds).where(eq(holds.status, "active")),
    db.select({ currency: feeSchedules.currency, total: sql<number>`coalesce(sum(greatest(${feeSchedules.amount} - ${feeSchedules.paid}, 0)), 0)::bigint` }).from(feeSchedules).groupBy(feeSchedules.currency),
    db.select({ currency: payments.currency, total: sql<number>`coalesce(sum(${payments.amount}), 0)::bigint` }).from(payments).where(eq(payments.status, "verified")).groupBy(payments.currency),
    db.select({ id: payments.id, amount: payments.amount, currency: payments.currency, method: payments.method, status: payments.status,
      createdAt: payments.createdAt, displayName: users.displayName, firstName: users.firstName, lastName: users.lastName,
      email: users.email, registrationNumber: users.registrationNumber,
    }).from(payments).leftJoin(users, eq(payments.studentId, users.id)).orderBy(desc(payments.createdAt)).limit(8),
    db.select({ value: settings.value, updatedAt: settings.updatedAt }).from(settings).where(eq(settings.key, "payment_details")).limit(1),
  ]);
  const paymentDetails = settingsRow[0]?.value && typeof settingsRow[0].value === "object" ? settingsRow[0].value as Record<string, unknown> : {};
  const bankAccounts = Array.isArray(paymentDetails.bankAccounts) ? paymentDetails.bankAccounts.join(", ") : "Not configured";
  return (
    <PortalShell title="Finance Overview" nav={nav}>
      <h1 className="display-font text-2xl font-bold mb-4">Finance Overview</h1>
      <p className="mb-4 text-sm opacity-70">Finance oversight from recorded payment, fee, and student hold data.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard className="p-5"><div className="text-sm opacity-65">Payment submissions</div><div className="mt-2 text-3xl font-bold">{paymentsCount[0]?.total ?? 0}</div></GlassCard>
        <GlassCard className="p-5"><div className="text-sm opacity-65">Awaiting verification</div><div className="mt-2 text-3xl font-bold">{pendingCount[0]?.total ?? 0}</div></GlassCard>
        <GlassCard className="p-5"><div className="text-sm opacity-65">Active holds</div><div className="mt-2 text-3xl font-bold">{holdCount[0]?.total ?? 0}</div></GlassCard>
        <GlassCard className="p-5"><div className="text-sm opacity-65">Outstanding fee schedules</div><div className="mt-2 space-y-1 text-lg font-bold">{balances.length ? balances.map((balance) => <div key={balance.currency}>{balance.currency} {Number(balance.total ?? 0).toLocaleString()}</div>) : <div>None</div>}</div></GlassCard>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <GlassCard className="p-5">
          <h2 className="mb-3 font-semibold">Verified collections</h2>
          {collections.length ? <ul className="space-y-2">{collections.map((item) => <li key={item.currency} className="flex justify-between gap-3"><span>{item.currency}</span><strong>{Number(item.total).toLocaleString()}</strong></li>)}</ul> : <p className="text-sm opacity-65">No verified payment records yet.</p>}
          <p className="mt-3 text-xs opacity-60">Collections total only payments marked verified. Outstanding totals come from student fee schedules.</p>
        </GlassCard>
        <GlassCard className="p-5">
          <h2 className="mb-3 font-semibold">Configured payment instructions</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="opacity-60">Account name</dt><dd>{typeof paymentDetails.accountName === "string" ? paymentDetails.accountName : "Not configured"}</dd></div>
            <div><dt className="opacity-60">Bank accounts</dt><dd>{bankAccounts}</dd></div>
            <div><dt className="opacity-60">MTN merchant code</dt><dd>{typeof paymentDetails.mtnMerchant === "string" ? paymentDetails.mtnMerchant : "Not configured"}</dd></div>
            <div><dt className="opacity-60">Airtel merchant code</dt><dd>{typeof paymentDetails.airtelMerchant === "string" ? paymentDetails.airtelMerchant : "Not configured"}</dd></div>
            <div className="text-xs opacity-60">Read from the same settings record used by the public Pay Now page{settingsRow[0] ? ` · last updated ${settingsRow[0].updatedAt.toLocaleString()}` : " · payment_details is missing"}.</div>
          </dl>
        </GlassCard>
      </div>
      <GlassCard className="mt-4 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Recent payments</h2><Link href="/admin/payments" className="text-sm font-semibold underline">All payment records</Link></div>
        {recentPayments.length ? <ul className="divide-y divide-[var(--border-strong)]">{recentPayments.map((payment) => <li key={payment.id} className="flex flex-wrap justify-between gap-3 py-3"><div><div className="font-medium">{payment.displayName ?? ([payment.firstName, payment.lastName].filter(Boolean).join(" ") || payment.email || "Student not linked")}{payment.registrationNumber ? ` · ${payment.registrationNumber}` : ""}</div><div className="text-sm opacity-65">{payment.currency} {payment.amount.toLocaleString()} · {payment.method.replaceAll("_", " ")} · {payment.createdAt.toLocaleString()}</div></div><span className="text-sm font-semibold">{payment.status}</span></li>)}</ul> : <p className="text-sm opacity-65">No payment submissions are recorded.</p>}
      </GlassCard>
      <GlassCard className="mt-4 p-5">
        <h2 className="mb-3 font-semibold">Finance records</h2>
        <div className="flex flex-wrap gap-3">{[
          ["Fee structures", "/admin/fee-structures"], ["Payments", "/admin/payments"], ["Holds", "/admin/holds"],
          ["Receipts", "/admin/receipts"], ["Refunds", "/admin/refunds"], ["Debtors", "/admin/debtors"],
          ["Payment settings", "/admin/payment-settings"],
        ].map(([label, href]) => <Link key={href} href={href} className="btn-glass px-4 py-2">{label}</Link>)}</div>
      </GlassCard>
    </PortalShell>
  );
}
