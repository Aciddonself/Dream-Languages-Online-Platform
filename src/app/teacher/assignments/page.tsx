import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/rbac";
import { db } from "@/db";
import { assignments, classes, submissions, users } from "@/db/schema";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { AssignmentCreateForm } from "@/components/assignment-create-form";
import { AssignmentGradeForm } from "@/components/assignment-grade-form";
import { formatSchoolDateTime } from "@/lib/school-time";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/teacher", label: "Dashboard", icon: "🏠" },
  { href: "/teacher/classes", label: "My Classes", icon: "📚" },
  { href: "/teacher/assignments", label: "Assignments", icon: "🗂️" },
  { href: "/teacher/attendance", label: "Attendance", icon: "✅" },
  { href: "/teacher/materials", label: "Materials", icon: "📄" },
  { href: "/teacher/exams", label: "Exams", icon: "📝" },
  { href: "/teacher/community", label: "Class discussions", icon: "💬" },
  { href: "/teacher/live", label: "Live Classes", icon: "🎥" },
];

export default async function TeacherAssignmentsPage() {
  const actor = await requireRole(["teacher", "head_academics", "super_admin"]);
  const teacherOnly = actor.role === "teacher";
  const classList = await db.select({ id: classes.id, name: classes.name }).from(classes)
    .where(teacherOnly ? and(eq(classes.teacherId, actor.id), isNull(classes.deletedAt)) : isNull(classes.deletedAt))
    .orderBy(classes.name);
  const assignmentList = await db.select({
    id: assignments.id, title: assignments.title, description: assignments.description,
    dueAt: assignments.dueAt, maxScore: assignments.maxScore, classId: assignments.classId, className: classes.name,
  }).from(assignments).leftJoin(classes, eq(assignments.classId, classes.id))
    .where(teacherOnly ? eq(assignments.teacherId, actor.id) : undefined)
    .orderBy(desc(assignments.createdAt)).limit(100);
  const ids = assignmentList.map((item) => item.id);
  const submissionRows = ids.length ? await db.select({
    id: submissions.id, assignmentId: submissions.assignmentId, studentId: submissions.studentId,
    text: submissions.text, fileUrl: submissions.fileUrl, score: submissions.score, feedback: submissions.feedback,
    submittedAt: submissions.submittedAt, gradedAt: submissions.gradedAt,
    displayName: users.displayName, firstName: users.firstName, lastName: users.lastName, email: users.email,
  }).from(submissions).leftJoin(users, eq(submissions.studentId, users.id))
    .where(inArray(submissions.assignmentId, ids))
    .orderBy(desc(submissions.submittedAt)) : [];
  const byAssignment = new Map<string, typeof submissionRows>();
  for (const item of assignmentList) byAssignment.set(item.id, submissionRows.filter((submission) => submission.assignmentId === item.id));

  return <PortalShell title="Assignments" nav={nav}>
    <h1 className="display-font mb-2 text-3xl font-bold">Assignments</h1>
    <p className="mb-5 text-sm opacity-65">Create class work, review student submissions, and return a score with feedback.</p>
    <GlassCard className="mb-5 p-5"><h2 className="mb-3 font-semibold">Create assignment</h2><AssignmentCreateForm classes={classList} /></GlassCard>
    <div className="space-y-4">{assignmentList.length ? assignmentList.map((item) => {
      const rows = byAssignment.get(item.id) ?? [];
      return <GlassCard className="p-5" key={item.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold">{item.title}</h2><p className="text-sm opacity-65">{item.className ?? "Class"} · Due {item.dueAt ? formatSchoolDateTime(item.dueAt) : "No deadline"} · Maximum score {item.maxScore ?? 100}</p></div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{rows.length} submission{rows.length === 1 ? "" : "s"}</span>
        </div>
        {item.description && <p className="mt-3 whitespace-pre-wrap text-sm opacity-80">{item.description}</p>}
        <div className="mt-4 space-y-3">{rows.length ? rows.map((submission) => {
          const studentName = submission.displayName || [submission.firstName, submission.lastName].filter(Boolean).join(" ") || submission.email || "Student";
          return <div className="rounded-xl border border-white/10 p-4" key={submission.id}>
            <div className="flex flex-wrap justify-between gap-2"><strong>{studentName}</strong><span className="text-xs opacity-65">Submitted {formatSchoolDateTime(submission.submittedAt)}</span></div>
            {submission.text && <p className="mt-3 whitespace-pre-wrap text-sm">{submission.text}</p>}
            {submission.fileUrl && <a className="mt-3 inline-block text-sm font-semibold underline" href={submission.fileUrl}>Download student file</a>}
            <AssignmentGradeForm assignmentId={item.id} submissionId={submission.id} maxScore={item.maxScore ?? 100} score={submission.score} feedback={submission.feedback} />
          </div>;
        }) : <p className="rounded-xl border border-white/10 p-3 text-sm opacity-65">No submissions have arrived.</p>}</div>
      </GlassCard>;
    }) : <GlassCard className="p-5 text-sm opacity-65">No assignments have been created yet.</GlassCard>}</div>
  </PortalShell>;
}
