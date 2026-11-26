import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { StudentAccessOverrides } from "@/components/student-access-overrides";
import { requireRole } from "@/lib/rbac";
import { PORTAL_NAVS } from "@/lib/portal-nav";

export const dynamic = "force-dynamic";

export default async function StudentAccessPage() {
  await requireRole(["admin", "super_admin"]);
  return <PortalShell title="Student fee access" nav={PORTAL_NAVS.finance}>
    <div className="mb-5"><h1 className="display-font text-3xl font-bold">Student fee access exceptions</h1><p className="mt-1 text-sm opacity-70">Review balances and grant or revoke a documented exception. Only administrators can change the exception.</p></div>
    <GlassCard className="p-4 md:p-5"><StudentAccessOverrides /></GlassCard>
  </PortalShell>;
}
