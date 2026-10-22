import { DiscussionHub } from "@/components/discussion-hub";
import { AnnouncementCreate } from "@/components/announcement-create";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { requireRole } from "@/lib/rbac";
import { getDiscussionHubData } from "@/lib/discussion-data";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/hoc", label: "Dashboard", icon: "🏠" },
  { href: "/hoc/teachers", label: "Teachers", icon: "👩‍🏫" },
  { href: "/hoc/exams", label: "Exam Oversight", icon: "📝" },
  { href: "/hoc/community", label: "Class discussions", icon: "💬" },
  { href: "/hoc/community", label: "Class discussions", icon: "💬" },
];

export default async function HeadAcademicsCommunityPage() {
  const user = await requireRole(["head_academics", "super_admin"]);
  const data = await getDiscussionHubData(user.id, user.role);
  return (
    <PortalShell title="Head of Academics" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Academic Discussions</h1>
      <p className="text-sm opacity-65 mb-5">Organize private class discussions and communicate with enrolled learners and teachers.</p>
      <GlassCard className="mb-5 p-5"><h2 className="font-semibold mb-3">Post an announcement</h2><AnnouncementCreate classes={data.classes} allowAll /></GlassCard>
      <DiscussionHub rooms={data.rooms} classes={data.classes} canCreate={data.canCreate} canTeachNumbers={false} currentUserId={user.id} />
    </PortalShell>
  );
}
