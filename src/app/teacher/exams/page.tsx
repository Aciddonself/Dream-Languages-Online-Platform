import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { AssessmentManager } from "@/components/assessment-manager";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { classes, enrolments, exams, users } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/teacher", label: "Dashboard", icon: "🏠" },
  { href: "/teacher/classes", label: "My Classes", icon: "📚" },
  { href: "/teacher/attendance", label: "Attendance", icon: "✅" },
  { href: "/teacher/materials", label: "Materials", icon: "📄" },
  { href: "/teacher/exams", label: "Exams", icon: "📝" },
  { href: "/teacher/community", label: "Class discussions", icon: "💬" },
  { href: "/teacher/live", label: "Live Classes", icon: "🎥" },
];

export default async function TeacherExamsPage() {
  const actor = await requireRole(["teacher", "head_academics", "super_admin"]);
  const teacherOnly = actor.role === "teacher";
  const schoolClasses = await db.select({ id: classes.id, name: classes.name }).from(classes)
    .where(teacherOnly ? and(eq(classes.teacherId, actor.id), isNull(classes.deletedAt)) : isNull(classes.deletedAt))
    .orderBy(classes.name);
  const classIds = schoolClasses.map((item) => item.id);
  const [assessmentList, roster] = await Promise.all([
    db.select({ id: exams.id, title: exams.title, assessmentType: exams.assessmentType, classId: exams.classId })
      .from(exams).where(teacherOnly ? eq(exams.teacherId, actor.id) : undefined).orderBy(desc(exams.createdAt)).limit(100),
    classIds.length
      ? db.select({
          id: users.id,
          displayName: users.displayName,
          firstName: users.firstName,
          lastName: users.lastName,
          classId: classes.id,
          className: classes.name,
        }).from(enrolments)
          .innerJoin(users, eq(enrolments.studentId, users.id))
          .innerJoin(classes, eq(enrolments.classId, classes.id))
          .where(and(inArray(enrolments.classId, classIds), eq(enrolments.status, "active"), eq(users.role, "student")))
          .orderBy(classes.name, users.firstName)
      : [],
  ]);
  const students = roster.map((student) => ({
    id: student.id,
    name: student.displayName ?? ([student.firstName, student.lastName].filter(Boolean).join(" ") || "Student"),
    classId: student.classId,
    className: student.className,
  }));
  return (
    <PortalShell title="Teacher Portal" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Assessments and Results</h1>
      <p className="text-sm opacity-65 mb-5">Create class assessments and publish marks. A final-examination score of 65% or higher advances the student when a next-level class is available. The Head of Academics records documented exceptions.</p>
      <GlassCard className="p-5 mb-5"><AssessmentManager classes={schoolClasses} exams={assessmentList} students={students} canReviewPromotion={!teacherOnly} /></GlassCard>
      <GlassCard className="p-5">
        <h2 className="font-semibold mb-3">Published assessments</h2>
        {assessmentList.length ? <ul className="space-y-2">{assessmentList.map((exam) => (
          <li key={exam.id} className="flex justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm">
            <span>{exam.title}</span><span className="opacity-65">{exam.assessmentType.replaceAll("_", " ")}</span>
          </li>
        ))}</ul> : <p className="text-sm opacity-65">No assessments have been created.</p>}
      </GlassCard>
    </PortalShell>
  );
}
