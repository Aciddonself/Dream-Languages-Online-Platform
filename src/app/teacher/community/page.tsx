import { DiscussionHub } from "@/components/discussion-hub";
import { AnnouncementCreate } from "@/components/announcement-create";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { requireRole } from "@/lib/rbac";
import { getDiscussionHubData } from "@/lib/discussion-data";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/teacher", label: "Dashboard", icon: "🏠" },
  { href: "/teacher/classes", label: "My Classes", icon: "📚" },
  { href: "/teacher/attendance", label: "Attendance", icon: "✅" },
  { href: "/teacher/materials", label: "Materials", icon: "📄" },
  { href: "/teacher/exams", label: "Exams", icon: "📝" },
  { href: "/teacher/community", label: "Class discussions", icon: "💬" },
  { href: "/teacher/community", label: "Class discussions", icon: "💬" },
  { href: "/teacher/live", label: "Live Classes", icon: "🎥" },
];

export default async function TeacherCommunityPage() {
  const user = await requireRole(["teacher", "head_academics", "super_admin"]);
  const data = await getDiscussionHubData(user.id, user.role);
  return (
    <PortalShell title="Teacher Portal" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Class Discussions</h1>
      <p className="text-sm opacity-65 mb-5">Create a private room for a class. Enrolled students and academic leads are added automatically.</p>
      <GlassCard className="mb-5 p-5"><h2 className="font-semibold mb-3">Post an announcement</h2><AnnouncementCreate classes={data.classes} allowAll={user.role !== "teacher"} /></GlassCard>
      <DiscussionHub rooms={data.rooms} classes={data.classes} canCreate={data.canCreate} canTeachNumbers={user.role !== "super_admin"} currentUserId={user.id} />
    </PortalShell>
  );
}
