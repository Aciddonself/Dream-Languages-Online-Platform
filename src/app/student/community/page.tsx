import { DiscussionHub } from "@/components/discussion-hub";
import { PortalShell } from "@/components/portal-shell";
import { requireRole } from "@/lib/rbac";
import { getDiscussionHubData } from "@/lib/discussion-data";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/fees", label: "Fees", icon: "💰" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
  { href: "/student/exams", label: "Exams", icon: "📝" },
  { href: "/student/results", label: "Results", icon: "📊" },
  { href: "/student/materials", label: "Materials", icon: "📄" },
  { href: "/student/community", label: "Class discussion", icon: "💬" },
  { href: "/student/reviews", label: "Share a Review", icon: "⭐" },
];

export default async function StudentCommunityPage() {
  const user = await requireRole(["student"]);
  const data = await getDiscussionHubData(user.id, user.role);
  return (
    <PortalShell title="Student Portal" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Class Discussion</h1>
      <p className="text-sm opacity-65 mb-5">Chat privately with your class, teacher, and Head of Academics.</p>
      <DiscussionHub rooms={data.rooms} classes={data.classes} canCreate={false} canTeachNumbers={false} currentUserId={user.id} />
    </PortalShell>
  );
}
