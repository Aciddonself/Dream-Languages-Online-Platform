import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { FinanceCashbook } from "@/components/finance-cashbook";
import { PORTAL_NAVS } from "@/lib/portal-nav";

export const dynamic = "force-dynamic";

export default async function WeeklyCashbookPage() {
  await requireRole(["finance", "admin", "super_admin"]);
  return <PortalShell title="Weekly Cashbook" nav={PORTAL_NAVS.finance}>
    <div className="mb-5"><h1 className="display-font text-3xl font-bold">Weekly money in and money out</h1><p className="mt-1 max-w-3xl text-sm opacity-70">Record receipts and spending by date. Weekly opening balances carry forward automatically, and the monthly PDF combines the weekly detail and totals.</p></div>
    <GlassCard className="p-4 md:p-5"><FinanceCashbook /></GlassCard>
  </PortalShell>;
}
