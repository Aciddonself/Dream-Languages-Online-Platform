import { and, desc, eq, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/rbac";
import { db } from "@/db";
import { assignments, classes, enrolments, submissions } from "@/db/schema";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { AssignmentSubmissionForm } from "@/components/assignment-submission-form";
import { formatSchoolDateTime } from "@/lib/school-time";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/assignments", label: "Assignments", icon: "🗂️" },
  { href: "/student/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/student/fees", label: "Fees", icon: "💰" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
  { href: "/student/exams", label: "Exams", icon: "📝" },
  { href: "/student/results", label: "Results", icon: "📊" },
  { href: "/student/materials", label: "Materials", icon: "📄" },
  { href: "/student/community", label: "Community", icon: "💬" },
];

export default async function StudentAssignmentsPage() {
  const student = await requireRole(["student"]);
  const activeEnrollments = await db.select({ classId: enrolments.classId, className: classes.name })
    .from(enrolments).innerJoin(classes, eq(enrolments.classId, classes.id))
    .where(and(eq(enrolments.studentId, student.id), eq(enrolments.status, "active")));
  const classIds = activeEnrollments.map((row) => row.classId);
  const list = classIds.length ? await db.select({
    id: assignments.id, title: assignments.title, description: assignments.description, dueAt: assignments.dueAt,
    maxScore: assignments.maxScore, classId: assignments.classId,
  }).from(assignments).where(inArray(assignments.classId, classIds)).orderBy(desc(assignments.dueAt)) : [];
  const submitted = list.length ? await db.select().from(submissions).where(and(
    inArray(submissions.assignmentId, list.map((item) => item.id)), eq(submissions.studentId, student.id),
  )) : [];
  const byAssignment = new Map<string, typeof submitted[number]>();
  for (const row of submitted) if (row.assignmentId) byAssignment.set(row.assignmentId, row);

  return <PortalShell title="My Assignments" nav={nav}>
    <h1 className="display-font mb-2 text-3xl font-bold">My Assignments</h1>
    <p className="mb-5 text-sm opacity-65">Read your teacher&apos;s instructions and submit written work or an attachment before the deadline. You can resubmit until grading begins.</p>
    <div className="space-y-4">{list.length ? list.map((item) => {
      const submission = byAssignment.get(item.id);
      const late = Boolean(item.dueAt && item.dueAt <= new Date());
      const locked = late || Boolean(submission?.gradedAt);
      return <GlassCard className="p-5" key={item.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold">{item.title}</h2><p className="text-sm opacity-65">{activeEnrollments.find((row) => row.classId === item.classId)?.className} · Due {item.dueAt ? formatSchoolDateTime(item.dueAt) : "No deadline"} · Max {item.maxScore ?? 100}</p></div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{submission ? submission.gradedAt ? "Graded" : late ? "Submitted · late" : "Submitted" : late ? "Closed" : "To do"}</span>
        </div>
        {item.description && <p className="mt-3 whitespace-pre-wrap text-sm opacity-80">{item.description}</p>}
        {submission?.text && <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm"><strong>Your response</strong><p className="mt-1 whitespace-pre-wrap">{submission.text}</p></div>}
        {submission?.fileUrl && <a className="mt-3 inline-block text-sm font-semibold underline" href={submission.fileUrl}>Download your submitted file</a>}
        {submission?.gradedAt && <div className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm"><strong>Grade: {submission.score ?? "—"}/{item.maxScore ?? 100}</strong>{submission.feedback && <p className="mt-1 whitespace-pre-wrap">{submission.feedback}</p>}</div>}
        {!locked && <AssignmentSubmissionForm assignmentId={item.id} />}
      </GlassCard>;
    }) : <GlassCard className="p-5 text-sm opacity-65">No assignments are available for your active classes yet.</GlassCard>}</div>
  </PortalShell>;
}
