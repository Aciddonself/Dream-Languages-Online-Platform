import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { AssessmentAttempts } from "@/components/assessment-attempts";
import { AssessmentManager } from "@/components/assessment-manager";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { classes, enrolments, examAttempts, exams, results, users } from "@/db/schema";
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

export default async function TeacherExamsPage() {
  const actor = await requireRole(["teacher", "head_academics", "super_admin"]);
  const teacherOnly = actor.role === "teacher";
  const schoolClasses = await db.select({ id: classes.id, name: classes.name }).from(classes)
    .where(teacherOnly ? and(eq(classes.teacherId, actor.id), isNull(classes.deletedAt)) : isNull(classes.deletedAt))
    .orderBy(classes.name);
  const classIds = schoolClasses.map((item) => item.id);
  const [assessmentList, roster, attempts] = await Promise.all([
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
    db.select({
      id: examAttempts.id, examId: exams.id, studentId: users.id, examTitle: exams.title,
      score: examAttempts.score, submittedAt: examAttempts.submittedAt, published: results.published,
      displayName: users.displayName, firstName: users.firstName, lastName: users.lastName,
    }).from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.id))
      .innerJoin(users, eq(examAttempts.studentId, users.id))
      .leftJoin(results, and(eq(results.examId, examAttempts.examId), eq(results.studentId, examAttempts.studentId)))
      .where(teacherOnly
        ? and(eq(exams.teacherId, actor.id), eq(examAttempts.status, "submitted"))
        : eq(examAttempts.status, "submitted"))
      .orderBy(desc(examAttempts.submittedAt)).limit(100),
  ]);
  const students = roster.map((student) => ({
    id: student.id,
    name: student.displayName ?? ([student.firstName, student.lastName].filter(Boolean).join(" ") || "Student"),
    classId: student.classId,
    className: student.className,
  }));
  const submittedAttempts = attempts.map((attempt) => ({
    id: attempt.id,
    examId: attempt.examId,
    studentId: attempt.studentId,
    examTitle: attempt.examTitle,
    score: attempt.score,
    submittedAt: attempt.submittedAt,
    published: attempt.published,
    studentName: attempt.displayName ?? ([attempt.firstName, attempt.lastName].filter(Boolean).join(" ") || "Student"),
  }));
  return (
    <PortalShell title="Teacher Portal" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Assessments and Results</h1>
      <p className="text-sm opacity-65 mb-5">Create class assessments and publish marks. A final-examination score of 65% or higher advances the student when a next-level class is available. The Head of Academics records documented exceptions.</p>
      <GlassCard className="p-5 mb-5"><AssessmentManager classes={schoolClasses} exams={assessmentList} students={students} canReviewPromotion={!teacherOnly} /></GlassCard>
      <GlassCard className="p-5 mb-5">
        <h2 className="mb-3 font-semibold">Submitted online assessments</h2>
        <p className="mb-4 text-sm opacity-65">Review each auto-graded score and publish it to the student&apos;s official results.</p>
        <AssessmentAttempts attempts={submittedAttempts} />
      </GlassCard>
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
