import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { StaffAssistantChat } from "./staff-chat";

export const dynamic = "force-dynamic";

export default async function TeacherFatherDla() {
  const user = await requireRole(["teacher", "head_academics", "super_admin"]);
  return (
    <PortalShell title="Teacher Portal" nav={[]}>
      <div className="mb-5">
        <h1 className="display-font text-3xl font-bold">Father-DLA Teaching Assistant</h1>
        <p className="text-sm opacity-70 mt-1">Lesson plans, test creation, translation and feedback help.</p>
      </div>
      <StaffAssistantChat name={user.firstName ?? "Teacher"} />
    </PortalShell>
  );
}
