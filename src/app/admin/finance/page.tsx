import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { feeSchedules, holds, payments } from "@/db/schema";
import { count, eq, sql } from "drizzle-orm";

const nav = [{ href: "/admin", label: "Dashboard", icon: "🏠" }, { href: "/admin/finance", label: "Finance", icon: "💰" }];

export default async function AdminFinance() {
  await requireRole(["super_admin"]);
  const [paymentsCount, holdCount, balances] = await Promise.all([
    db.select({ total: count() }).from(payments),
    db.select({ total: count() }).from(holds).where(eq(holds.status, "active")),
    db.select({ currency: feeSchedules.currency, total: sql<number>`coalesce(sum(${feeSchedules.amount} - ${feeSchedules.paid}), 0)` }).from(feeSchedules).groupBy(feeSchedules.currency),
  ]);
  return (
    <PortalShell title="Finance Overview" nav={nav}>
      <h1 className="display-font text-2xl font-bold mb-4">Finance Overview</h1>
      <p className="mb-4 text-sm opacity-70">Finance oversight from recorded payment, fee, and student hold data.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-5"><div className="text-sm opacity-65">Recorded payments</div><div className="mt-2 text-3xl font-bold">{paymentsCount[0]?.total ?? 0}</div></GlassCard>
        <GlassCard className="p-5"><div className="text-sm opacity-65">Active holds</div><div className="mt-2 text-3xl font-bold">{holdCount[0]?.total ?? 0}</div></GlassCard>
        <GlassCard className="p-5"><div className="text-sm opacity-65">Outstanding fees</div><div className="mt-2 space-y-1 text-lg font-bold">{balances.length ? balances.map((balance) => <div key={balance.currency}>{balance.currency} {Number(balance.total).toLocaleString()}</div>) : <div>None</div>}</div></GlassCard>
      </div>
      <GlassCard className="mt-4 p-5"><p className="text-sm opacity-70">Use the Finance portal to review payment records, holds, and collection reports.</p></GlassCard>
    </PortalShell>
  );
}