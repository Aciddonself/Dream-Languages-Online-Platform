import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { classes, enrolments, exams } from "@/db/schema";
import { getStudentExamEligibility } from "@/lib/exam-eligibility";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/fees", label: "Fees", icon: "💰" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
  { href: "/student/exams", label: "Exams", icon: "📝" },
  { href: "/student/results", label: "Results", icon: "📊" },
  { href: "/student/materials", label: "Materials", icon: "📄" },
  { href: "/student/community", label: "Community", icon: "💬" },
  { href: "/student/reviews", label: "Share a Review", icon: "⭐" },
];

export default async function StudentExamsPage() {
  const user = await requireRole(["student"]);
  const enrolled = await db.select({ id: classes.id, name: classes.name }).from(enrolments)
    .innerJoin(classes, eq(enrolments.classId, classes.id))
    .where(and(eq(enrolments.studentId, user.id), eq(enrolments.status, "active")));
  const classIds = enrolled.map((item) => item.id);
  const examsList = classIds.length
    ? await db.select({
        id: exams.id,
        title: exams.title,
        description: exams.description,
        assessmentType: exams.assessmentType,
        classId: exams.classId,
        startsAt: exams.startsAt,
        endsAt: exams.endsAt,
        durationMinutes: exams.durationMinutes,
        className: classes.name,
      }).from(exams).innerJoin(classes, eq(exams.classId, classes.id))
        .where(and(inArray(exams.classId, classIds), eq(exams.published, true)))
        .orderBy(exams.startsAt)
    : [];
  const records = await Promise.all(examsList.map(async (exam) => ({
    exam,
    eligibility: await getStudentExamEligibility(user.id, exam.classId!),
  })));
  return (
    <PortalShell title="Student Portal" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Tests and Examinations</h1>
      <p className="text-sm opacity-65 mb-5">Exam eligibility requires at least 60% attendance or a cleared fee balance. Attendance is calculated from teacher-confirmed class sessions.</p>
      <div className="flex flex-wrap gap-3 mb-5">
        <Link className="glass rounded-xl px-4 py-2 text-sm font-semibold" href="/api/portal/documents/test-report">Download test report card</Link>
        <Link className="glass rounded-xl px-4 py-2 text-sm font-semibold" href="/api/portal/documents/final-report">Download final exam report card</Link>
      </div>
      <div className="grid gap-3">
        {records.length ? records.map(({ exam, eligibility }) => (
          <GlassCard key={exam.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{exam.title}</h2>
                <p className="text-sm opacity-65">{exam.className} · {exam.assessmentType.replaceAll("_", " ")} · {exam.startsAt?.toLocaleString() ?? "Schedule to be announced"} · {exam.durationMinutes ?? 60} minutes</p>
                {exam.description && <p className="mt-2 text-sm opacity-75">{exam.description}</p>}
              </div>
              <span className={eligibility.eligible ? "rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-700" : "rounded-full bg-amber-500/15 px-3 py-1 text-sm text-amber-800"}>
                {eligibility.eligible ? "Eligible" : "Not eligible"}
              </span>
            </div>
            <p className="mt-3 text-sm opacity-70">Attendance: {eligibility.attendancePercent}% · Fee balance: {eligibility.feeBalanceLabel}{eligibility.basis === "fees_clear" && eligibility.attendancePercent < 60 ? " · Fee-clear exception applied" : ""}{eligibility.basis === "not_eligible" && eligibility.feeBalance === 0 && eligibility.attendancePercent < 60 ? " · No cleared fee schedule is on file" : ""}</p>
          </GlassCard>
        )) : <GlassCard className="p-5 text-sm opacity-65">No published assessments are assigned to your active classes.</GlassCard>}
      </div>
    </PortalShell>
  );
}
