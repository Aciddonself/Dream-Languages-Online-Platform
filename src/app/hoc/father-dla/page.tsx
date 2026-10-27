import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { StaffAssistantChat } from "@/app/teacher/father-dla/staff-chat";

export const dynamic = "force-dynamic";

export default async function HocFatherDla() {
  const user = await requireRole(["head_academics", "super_admin"]);
  return (
    <PortalShell title="Head of Academics" nav={[]}>
      <div className="mb-5">
        <h1 className="display-font text-3xl font-bold">Father-DLA Assistant</h1>
        <p className="text-sm opacity-70 mt-1">Help with lesson plans, assessments, translations and reports.</p>
      </div>
      <StaffAssistantChat name={user.firstName ?? "Head of Academics"} />
    </PortalShell>
  );
}
