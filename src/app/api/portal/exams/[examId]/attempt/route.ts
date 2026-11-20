import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, enrolments, examAttempts, examQuestions, exams, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getStudentExamEligibility } from "@/lib/exam-eligibility";

const answersSchema = z.record(z.string(), z.string().max(2000));
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }).strict(),
  z.object({ action: z.literal("save"), answers: answersSchema }).strict(),
  z.object({ action: z.literal("submit"), answers: answersSchema }).strict(),
]);

type Question = { id: string; prompt: string; options: unknown; correctAnswer: string | null; points: number };
type Attempt = { id: string; startedAt: Date; submittedAt: Date | null; status: string; score: number | null; answers: unknown };

function cleanAnswers(value: unknown, questions: Question[]): Record<string, string> {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const allowed = new Map(questions.map((question) => [question.id, Array.isArray(question.options) ? question.options.filter((x): x is string => typeof x === "string") : []]));
  const answers: Record<string, string> = {};
  for (const [id, answer] of Object.entries(input)) {
    if (typeof answer === "string" && allowed.has(id) && allowed.get(id)!.includes(answer)) answers[id] = answer;
  }
  return answers;
}

function scoreAnswers(answers: Record<string, string>, questions: Question[]) {
  const total = questions.reduce((sum, question) => sum + question.points, 0);
  const earned = questions.reduce((sum, question) => sum + (answers[question.id] === question.correctAnswer ? question.points : 0), 0);
  return total ? Math.round((earned / total) * 100) : 0;
}

function publicQuestions(questions: Question[]) {
  return questions.map(({ id, prompt, options, points }) => ({
    id, prompt, points,
    options: Array.isArray(options) ? options.filter((option): option is string => typeof option === "string") : [],
  }));
}

function deadline(attempt: Attempt, exam: { durationMinutes: number | null; endsAt: Date | null }) {
  const durationEnd = new Date(attempt.startedAt.getTime() + (exam.durationMinutes ?? 60) * 60_000);
  return exam.endsAt && exam.endsAt < durationEnd ? exam.endsAt : durationEnd;
}

export async function POST(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "student") return NextResponse.json({ error: "Student access required" }, { status: 403 });
  const { examId } = await params;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [exam] = await db.select({ id: exams.id, classId: exams.classId, published: exams.published, startsAt: exams.startsAt, endsAt: exams.endsAt, durationMinutes: exams.durationMinutes })
    .from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam || !exam.published || !exam.classId) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(
    eq(enrolments.studentId, actor.id), eq(enrolments.classId, exam.classId), eq(enrolments.status, "active"),
  )).limit(1);
  if (!enrollment) return NextResponse.json({ error: "You are not actively enrolled in this assessment class" }, { status: 403 });
  const questions = await db.select({ id: examQuestions.id, prompt: examQuestions.prompt, options: examQuestions.options, correctAnswer: examQuestions.correctAnswer, points: examQuestions.points })
    .from(examQuestions).where(eq(examQuestions.examId, examId)).orderBy(asc(examQuestions.order));
  if (!questions.length) return NextResponse.json({ error: "This assessment is not ready yet. Contact your teacher." }, { status: 409 });
  const now = new Date();

  if (parsed.data.action === "start") {
    const [existingAttempt] = await db.select({ id: examAttempts.id }).from(examAttempts)
      .where(and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, actor.id))).limit(1);
    if (!existingAttempt) {
      if (exam.startsAt && exam.startsAt > now) return NextResponse.json({ error: "This assessment has not started yet" }, { status: 409 });
      if (exam.endsAt && exam.endsAt <= now) return NextResponse.json({ error: "The assessment window has closed" }, { status: 409 });
      const eligibility = await getStudentExamEligibility(actor.id, exam.classId);
      if (!eligibility.eligible) return NextResponse.json({ error: "You do not meet the attendance or fee requirements for this assessment" }, { status: 403 });
    }
    const outcome = await db.transaction(async (tx: any) => {
      const [lockedStudent] = await tx.select({ id: users.id }).from(users).where(eq(users.id, actor.id)).for("update").limit(1);
      if (!lockedStudent) return { error: "Student account not found", status: 404 as const };
      let [attempt] = await tx.select().from(examAttempts).where(and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, actor.id))).limit(1);
      if (attempt) {
        const due = deadline(attempt, exam);
        if (attempt.status === "in_progress" && due <= now) {
          const answers = cleanAnswers(attempt.answers, questions);
          const score = scoreAnswers(answers, questions);
          [attempt] = await tx.update(examAttempts).set({ answers, score, status: "submitted", submittedAt: now }).where(eq(examAttempts.id, attempt.id)).returning();
        }
        return { attempt, questions };
      }
      const [created] = await tx.insert(examAttempts).values({ examId, studentId: actor.id, startedAt: now, status: "in_progress", answers: {} }).returning();
      await tx.insert(auditLogs).values({ actorId: actor.id, action: "start_online_assessment", entityType: "exam_attempt", entityId: created.id, after: { examId } });
      return { attempt: created as Attempt, questions };
    });
    if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({
      attempt: { id: outcome.attempt.id, status: outcome.attempt.status, startedAt: outcome.attempt.startedAt, deadline: deadline(outcome.attempt, exam), answers: outcome.attempt.answers ?? {} },
      questions: publicQuestions(outcome.questions),
    });
  }

  const [attempt] = await db.select().from(examAttempts).where(and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, actor.id))).limit(1);
  if (!attempt) return NextResponse.json({ error: "Start the assessment before saving answers" }, { status: 409 });
  if (attempt.status !== "in_progress") return NextResponse.json({ error: "This assessment has already been submitted" }, { status: 409 });
  const cleaned = cleanAnswers(parsed.data.answers, questions);
  const due = deadline(attempt, exam);
  const expired = due <= now;
  if (parsed.data.action === "submit" || expired) {
    const score = scoreAnswers(cleaned, questions);
    const [updated] = await db.update(examAttempts).set({ answers: cleaned, score, status: "submitted", submittedAt: now })
      .where(and(eq(examAttempts.id, attempt.id), eq(examAttempts.status, "in_progress"))).returning({ id: examAttempts.id });
    if (!updated) return NextResponse.json({ error: "This assessment has already been submitted" }, { status: 409 });
    await db.insert(auditLogs).values({ actorId: actor.id, action: expired ? "auto_submit_online_assessment" : "submit_online_assessment", entityType: "exam_attempt", entityId: attempt.id, after: { examId, score } });
    return NextResponse.json({ ok: true, status: "submitted", expired });
  }
  await db.update(examAttempts).set({ answers: cleaned }).where(and(eq(examAttempts.id, attempt.id), eq(examAttempts.status, "in_progress")));
  return NextResponse.json({ ok: true, status: "in_progress", saved: true, deadline: due });
}
