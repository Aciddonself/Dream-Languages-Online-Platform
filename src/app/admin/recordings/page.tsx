import { desc, eq, isNull } from "drizzle-orm";
import { AdminRecordingLibrary } from "@/components/admin-recording-library";
import { PortalShell } from "@/components/portal-shell";
import { db } from "@/db";
import { classes, classRecordings } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/academic", label: "Academic", icon: "🎓" },
  { href: "/admin/recordings", label: "Class recordings", icon: "🎬" },
  { href: "/admin/cms", label: "CMS", icon: "📝" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default async function AdminRecordingsPage() {
  await requireRole(["super_admin"]);
  const [schoolClasses, rows] = await Promise.all([
    db.select({ id: classes.id, name: classes.name }).from(classes).where(isNull(classes.deletedAt)).orderBy(classes.name),
    db.select({ id: classRecordings.id, title: classRecordings.title, description: classRecordings.description, fileName: classRecordings.fileName, uploadComplete: classRecordings.uploadComplete, createdAt: classRecordings.createdAt, className: classes.name })
      .from(classRecordings).innerJoin(classes, eq(classes.id, classRecordings.classId))
      .orderBy(desc(classRecordings.createdAt)).limit(100),
  ]);
  return <PortalShell title="Class recordings" nav={nav}>
    <h1 className="display-font mb-2 text-3xl font-bold">Recorded classes</h1>
    <p className="mb-5 text-sm opacity-65">Manage recordings, assign each to a class, and delete files when they are no longer needed.</p>
    <AdminRecordingLibrary classes={schoolClasses} recordings={rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))} />
  </PortalShell>;
}
