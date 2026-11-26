import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { classes, enrolments, examAttempts, exams, results } from "@/db/schema";
import { getStudentExamEligibility } from "@/lib/exam-eligibility";
import { requireRole } from "@/lib/rbac";
import { OnlineExam } from "@/components/online-exam";
import { StudentFeeAccessNotice } from "@/components/student-fee-access-notice";
import { getStudentFinanceAccess } from "@/lib/student-finance-access";

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

export default async function StudentExamsPage() {
  const user = await requireRole(["student"]);
  const financeAccess = await getStudentFinanceAccess(user.id);
  if (!financeAccess.canLearn) return <PortalShell title="Student Portal" nav={nav}><StudentFeeAccessNotice hasFeeSchedule={financeAccess.balanceByCurrency.length > 0} balances={financeAccess.balanceByCurrency} /></PortalShell>;
  const publishedResults = await db.select({ assessmentType: exams.assessmentType }).from(results)
    .innerJoin(exams, eq(results.examId, exams.id)).where(and(eq(results.studentId, user.id), eq(results.published, true)));
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
  const records = await Promise.all(examsList.map(async (exam) => {
    const [eligibility, attempt] = await Promise.all([
      getStudentExamEligibility(user.id, exam.classId!),
      db.select({ status: examAttempts.status }).from(examAttempts)
        .where(and(eq(examAttempts.examId, exam.id), eq(examAttempts.studentId, user.id))).limit(1),
    ]);
    return { exam, eligibility, attempt: attempt[0] };
  }));
  return (
    <PortalShell title="Student Portal" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Tests and Examinations</h1>
      <p className="text-sm opacity-65 mb-5">A cleared fee schedule is required before a student can sit a test or examination. An administrator may grant a documented exception.</p>
      <div className="flex flex-wrap gap-3 mb-5">
        {publishedResults.some((result) => result.assessmentType === "test") && <Link className="glass rounded-xl px-4 py-2 text-sm font-semibold" href="/api/portal/documents/test-report">Download test report card</Link>}
        {publishedResults.some((result) => result.assessmentType === "final_exam") && <Link className="glass rounded-xl px-4 py-2 text-sm font-semibold" href="/api/portal/documents/final-report">Download final exam report card</Link>}
      </div>
      <div className="grid gap-3">
        {records.length ? records.map(({ exam, eligibility, attempt }) => (
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
            <p className="mt-3 text-sm opacity-70">Fee status: {eligibility.feeBalanceLabel}{eligibility.basis === "admin_override" ? ` · Admin exception: ${eligibility.overrideReason}` : ""}</p>
            <OnlineExam examId={exam.id} eligible={eligibility.eligible} existingStatus={attempt?.status} />
          </GlassCard>
        )) : <GlassCard className="p-5 text-sm opacity-65">No published assessments are assigned to your active classes.</GlassCard>}
      </div>
    </PortalShell>
  );
}
