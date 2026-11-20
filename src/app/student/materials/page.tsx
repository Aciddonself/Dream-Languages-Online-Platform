import { and, desc, eq, inArray } from "drizzle-orm";
import { PortalShell } from "@/components/portal-shell";
import { ClassMaterialCard } from "@/components/class-material-card";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { classes, enrolments, materials } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/fees", label: "Fees", icon: "💰" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
  { href: "/student/exams", label: "Exams", icon: "📝" },
  { href: "/student/results", label: "Results", icon: "📊" },
  { href: "/student/materials", label: "Materials", icon: "📄" },
  { href: "/student/recordings", label: "Recorded classes", icon: "🎬" },
  { href: "/student/community", label: "Community", icon: "💬" },
  { href: "/student/reviews", label: "Share a Review", icon: "⭐" },
];

export default async function StudentMaterialsPage() {
  const user = await requireRole(["student"]);
  const classIds = await db.select({ id: enrolments.classId }).from(enrolments).where(and(eq(enrolments.studentId, user.id), eq(enrolments.status, "active")));
  const ids = classIds.map((item) => item.id);
  const items = ids.length
    ? await db.select({
        id: materials.id,
        title: materials.title,
        description: materials.description,
        fileUrl: materials.fileUrl,
        fileName: materials.fileName,
        type: materials.type,
        createdAt: materials.createdAt,
        className: classes.name,
      }).from(materials).leftJoin(classes, eq(materials.classId, classes.id))
        .where(and(inArray(materials.classId, ids), eq(materials.uploadComplete, true))).orderBy(desc(materials.createdAt)).limit(100)
    : [];
  return (
    <PortalShell title="Student Portal" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Class Materials</h1>
      <p className="text-sm opacity-65 mb-5">Videos, audio lessons, and documents shared by teachers of your enrolled classes.</p>
      <div className="grid gap-3">
        {items.length ? items.map((item) => <ClassMaterialCard key={item.id} item={item} />)
          : <GlassCard className="p-5 text-sm opacity-65">Your teachers have not uploaded any learning materials yet.</GlassCard>}
      </div>
    </PortalShell>
  );
}
