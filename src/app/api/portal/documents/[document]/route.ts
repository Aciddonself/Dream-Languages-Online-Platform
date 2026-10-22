import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, examAttempts, exams, results, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createTextPdf, readProfilePhotoJpeg } from "@/lib/pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ document: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "student" && user.role !== "applicant") {
    return NextResponse.json({ error: "Student or applicant access required" }, { status: 403 });
  }

  const { document } = await params;
  const name = user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const registrationNumber = user.registrationNumber ?? "Pending assignment";
  let title: string;
  let lines: string[];

  if (document === "admission") {
    title = "DLA Admission and Registration Form";
    const [admissionProfile] = await db
      .select({ departmentName: departments.name })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.id, user.id))
      .limit(1);
    lines = [
      "Dream Languages And Adult Literacy Uganda Limited",
      "",
      `Name: ${name}`,
      `Registration number: ${registrationNumber}`,
      `Email: ${user.email}`,
      `Phone: ${user.phone ?? "Not provided"}`,
      `Preferred course: ${admissionProfile?.departmentName ?? "To be confirmed by DLA"}`,
      `Account status: ${user.status}`,
      `Application date: ${user.createdAt.toISOString().slice(0, 10)}`,
      "",
      "This document confirms the registration details recorded by DLA.",
      "Course placement, class, and admission status are subject to school review.",
    ];
  } else if (["results", "test-report", "final-report"].includes(document)) {
    if (user.role !== "student") {
      return NextResponse.json({ error: "Results are available after student enrolment" }, { status: 403 });
    }
    title = document === "test-report"
      ? "Dream Languages Uganda Test Report Card"
      : document === "final-report"
        ? "Dream Languages Uganda Final Examination Report Card"
        : "Dream Languages Uganda Results Statement";
    const resultFilters = [
      eq(results.studentId, user.id),
      eq(results.published, true),
      ...(document === "test-report" ? [eq(exams.assessmentType, "test")] : []),
      ...(document === "final-report" ? [eq(exams.assessmentType, "final_exam")] : []),
    ];
    const [publishedResults, submittedAttempts] = await Promise.all([
      db
        .select({
          title: exams.title,
          score: results.score,
          grade: results.grade,
          comments: results.comments,
          assessmentType: exams.assessmentType,
          promotionStatus: results.promotionStatus,
          promotionReason: results.promotionReason,
        })
        .from(results)
        .innerJoin(exams, eq(results.examId, exams.id))
        .where(and(...resultFilters)),
      db
        .select({ title: exams.title, score: examAttempts.score, status: examAttempts.status, submittedAt: examAttempts.submittedAt })
        .from(examAttempts)
        .leftJoin(exams, eq(examAttempts.examId, exams.id))
        .where(document === "results" ? eq(examAttempts.studentId, user.id) : and(eq(examAttempts.studentId, user.id), eq(exams.assessmentType, document === "test-report" ? "test" : "final_exam"))),
    ]);

    lines = [
      "Dream Languages Uganda",
      `Name: ${name}`,
      `Registration number: ${registrationNumber}`,
      "",
      document === "test-report" ? "Published test results" : document === "final-report" ? "Published final examination results" : "Published results",
      ...(publishedResults.length
        ? publishedResults.map((result) =>
            `${result.title ?? "Assessment"} | ${result.assessmentType.replaceAll("_", " ")} | Score: ${result.score ?? "Pending"}% | Grade: ${result.grade ?? "Not graded"}${result.comments ? ` | ${result.comments}` : ""}${result.promotionStatus ? ` | Promotion: ${result.promotionStatus}${result.promotionReason ? ` (${result.promotionReason})` : ""}` : ""}`,
          )
        : ["No published results are available yet."]),
      "",
      ...(document === "results" ? ["", "Submitted test and exam attempts"] : []),
      ...(document === "results" && submittedAttempts.length
        ? submittedAttempts.map((attempt) =>
            `${attempt.title ?? "Assessment"} | Status: ${attempt.status} | Submitted: ${attempt.submittedAt?.toISOString().slice(0, 10) ?? "Not submitted"}`,
          )
        : document === "results" ? ["No submitted test or exam attempts are available yet."] : []),
      "",
      "Only results published for this student account are included.",
    ];
  } else {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const [profile] = await db.select({ avatarStorageKey: users.avatarStorageKey }).from(users).where(eq(users.id, user.id)).limit(1);
  const portrait = await readProfilePhotoJpeg(profile?.avatarStorageKey);
  const pdf = createTextPdf(title, lines, portrait);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dla-${document}-${registrationNumber.replaceAll("/", "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
