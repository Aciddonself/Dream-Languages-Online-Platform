import { and, desc, eq, inArray } from "drizzle-orm";
import { PortalShell } from "@/components/portal-shell";
import { StudentRecordingList } from "@/components/student-recording-list";
import { db } from "@/db";
import { classes, classRecordings, enrolments } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
  { href: "/student/recordings", label: "Recorded classes", icon: "🎬" },
  { href: "/student/materials", label: "Materials", icon: "📄" },
];

export default async function StudentRecordingsPage() {
  const user = await requireRole(["student"]);
  const enrolled = await db.select({ id: enrolments.classId }).from(enrolments).where(and(eq(enrolments.studentId, user.id), eq(enrolments.status, "active")));
  const classIds = enrolled.map((item) => item.id);
  const recordings = classIds.length ? await db.select({ id: classRecordings.id, title: classRecordings.title, description: classRecordings.description, fileName: classRecordings.fileName, createdAt: classRecordings.createdAt, className: classes.name })
    .from(classRecordings).innerJoin(classes, eq(classes.id, classRecordings.classId))
    .where(and(inArray(classRecordings.classId, classIds), eq(classRecordings.uploadComplete, true))).orderBy(desc(classRecordings.createdAt)).limit(100) : [];
  return <PortalShell title="Student Portal" nav={nav}>
    <h1 className="display-font mb-2 text-3xl font-bold">Recorded classes</h1>
    <p className="mb-5 text-sm opacity-65">Replay class recordings shared with your enrolled classes.</p>
    <StudentRecordingList recordings={recordings} />
  </PortalShell>;
}
