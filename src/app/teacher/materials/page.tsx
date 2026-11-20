import { and, desc, eq, isNull } from "drizzle-orm";
import { MaterialUploadForm } from "@/components/material-upload-form";
import { ClassMaterialCard } from "@/components/class-material-card";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { classes, materials } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/teacher", label: "Dashboard", icon: "🏠" },
  { href: "/teacher/assignments", label: "Assignments", icon: "🗂️" },
  { href: "/teacher/classes", label: "My Classes", icon: "📚" },
  { href: "/teacher/attendance", label: "Attendance", icon: "✅" },
  { href: "/teacher/materials", label: "Materials", icon: "📄" },
  { href: "/teacher/exams", label: "Exams", icon: "📝" },
  { href: "/teacher/community", label: "Class discussions", icon: "💬" },
  { href: "/teacher/live", label: "Live Classes", icon: "🎥" },
];

export default async function TeacherMaterialsPage() {
  const user = await requireRole(["teacher", "head_academics", "super_admin"]);
  const classesForUser = await db.select({ id: classes.id, name: classes.name }).from(classes)
    .where(user.role === "teacher" ? and(eq(classes.teacherId, user.id), isNull(classes.deletedAt)) : isNull(classes.deletedAt))
    .orderBy(classes.name);
  const items = await db.select({
    id: materials.id,
    title: materials.title,
    description: materials.description,
    fileUrl: materials.fileUrl,
    fileName: materials.fileName,
    type: materials.type,
    createdAt: materials.createdAt,
    className: classes.name,
  }).from(materials).leftJoin(classes, eq(materials.classId, classes.id))
    .where(user.role === "teacher" ? and(eq(materials.teacherId, user.id), eq(materials.uploadComplete, true)) : eq(materials.uploadComplete, true))
    .orderBy(desc(materials.createdAt)).limit(100);
  return (
    <PortalShell title="Teacher Portal" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Class Materials</h1>
      <p className="text-sm opacity-65 mb-5">Upload documents privately for students enrolled in the selected class.</p>
      <GlassCard className="p-5 mb-5"><MaterialUploadForm classes={classesForUser} /></GlassCard>
      <div className="grid gap-3">
        {items.length ? items.map((item) => <ClassMaterialCard key={item.id} item={item} canDelete />)
          : <GlassCard className="p-5 text-sm opacity-65">No learning materials have been uploaded.</GlassCard>}
      </div>
    </PortalShell>
  );
}
