import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, examAttempts, examQuestions, exams } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const questionSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(8),
  correctAnswer: z.string().trim().min(1).max(500),
  points: z.number().int().min(1).max(100),
}).strict().refine((question) => question.options.includes(question.correctAnswer), {
  message: "The correct answer must match one of the options",
  path: ["correctAnswer"],
});
const questionsSchema = z.object({ questions: z.array(questionSchema).min(1).max(100) }).strict();

async function getAuthorizedExam(examId: string, actor: { id: string; role: string }) {
  const [exam] = await db.select({ id: exams.id, teacherId: exams.teacherId }).from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) return { error: NextResponse.json({ error: "Assessment not found" }, { status: 404 }) };
  if (!["teacher", "head_academics", "super_admin"].includes(actor.role)) {
    return { error: NextResponse.json({ error: "Academic staff access required" }, { status: 403 }) };
  }
  if (actor.role === "teacher" && exam.teacherId !== actor.id) {
    return { error: NextResponse.json({ error: "You can only manage questions for your own assessments" }, { status: 403 }) };
  }
  return { exam };
}

export async function GET(_request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { examId } = await params;
  const authorized = await getAuthorizedExam(examId, actor);
  if ("error" in authorized) return authorized.error;
  const questions = await db.select().from(examQuestions).where(eq(examQuestions.examId, examId)).orderBy(examQuestions.order);
  return NextResponse.json({ questions });
}

export async function PUT(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { examId } = await params;
  const authorized = await getAuthorizedExam(examId, actor);
  if ("error" in authorized) return authorized.error;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = questionsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const outcome = await db.transaction(async (tx: any) => {
    await tx.select({ id: exams.id }).from(exams).where(eq(exams.id, examId)).for("update").limit(1);
    const [attempt] = await tx.select({ id: examAttempts.id }).from(examAttempts).where(eq(examAttempts.examId, examId)).limit(1);
    if (attempt) return { error: "Questions cannot be changed after a student has started this assessment", status: 409 as const };
    await tx.delete(examQuestions).where(eq(examQuestions.examId, examId));
    await tx.insert(examQuestions).values(parsed.data.questions.map((question, order) => ({
      examId, type: "mcq", prompt: question.prompt, options: question.options,
      correctAnswer: question.correctAnswer, points: question.points, order,
    })));
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "save_assessment_questions", entityType: "exam", entityId: examId, after: { questionCount: parsed.data.questions.length } });
    return { ok: true as const, count: parsed.data.questions.length };
  });
  if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json(outcome);
}
