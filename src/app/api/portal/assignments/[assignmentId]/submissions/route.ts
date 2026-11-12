import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assignments, auditLogs, classes, enrolments, submissions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const allowedTypes: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/webm": ".weba",
};

const gradeSchema = z.object({ score: z.number().int().min(0).max(1000), feedback: z.string().trim().max(3000).optional() }).strict();

async function assignmentAccess(assignmentId: string, actor: { id: string; role: string }) {
  const [assignment] = await db.select({ id: assignments.id, classId: assignments.classId, teacherId: assignments.teacherId, dueAt: assignments.dueAt, maxScore: assignments.maxScore, title: assignments.title })
    .from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  if (!assignment?.classId) return { error: NextResponse.json({ error: "Assignment not found" }, { status: 404 }) };
  if (actor.role === "student") {
    const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(
      eq(enrolments.studentId, actor.id), eq(enrolments.classId, assignment.classId), eq(enrolments.status, "active"),
    )).limit(1);
    if (!enrollment) return { error: NextResponse.json({ error: "You are not actively enrolled in this assignment class" }, { status: 403 }) };
    return { assignment, isStudent: true as const };
  }
  if (actor.role === "teacher") {
    if (assignment.teacherId !== actor.id) return { error: NextResponse.json({ error: "You cannot access this assignment" }, { status: 403 }) };
    return { assignment, isStudent: false as const };
  }
  if (["head_academics", "super_admin"].includes(actor.role)) return { assignment, isStudent: false as const };
  return { error: NextResponse.json({ error: "Academic portal access required" }, { status: 403 }) };
}

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { assignmentId } = await params;
  const access = await assignmentAccess(assignmentId, actor);
  if ("error" in access) return access.error;
  const rows = await db.select({
    id: submissions.id, studentId: submissions.studentId, text: submissions.text, fileUrl: submissions.fileUrl,
    score: submissions.score, feedback: submissions.feedback, submittedAt: submissions.submittedAt, gradedAt: submissions.gradedAt,
    displayName: users.displayName, firstName: users.firstName, lastName: users.lastName,
  }).from(submissions).leftJoin(users, eq(users.id, submissions.studentId))
    .where(access.isStudent
      ? and(eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, actor.id))
      : eq(submissions.assignmentId, assignmentId))
    .orderBy(asc(submissions.submittedAt));
  if (access.isStudent) {
    return NextResponse.json({ submissions: rows }, { headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json({ submissions: rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "student") return NextResponse.json({ error: "Student access required" }, { status: 403 });
  const { assignmentId } = await params;
  const access = await assignmentAccess(assignmentId, actor);
  if ("error" in access) return access.error;
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Could not read the submission form" }, { status: 400 }); }
  const text = String(form.get("text") ?? "").trim();
  const upload = form.get("file");
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  if (!text && !file) return NextResponse.json({ error: "Add your written response or attach a file" }, { status: 400 });
  if (text.length > 20_000) return NextResponse.json({ error: "Written responses must be 20,000 characters or fewer" }, { status: 400 });
  if (file && file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Submission files must be 20 MB or smaller" }, { status: 400 });
  const extension = file ? allowedTypes[file.type] : undefined;
  if (file && !extension) return NextResponse.json({ error: "Use PDF, Word, text, image, or audio files" }, { status: 415 });
  if (access.assignment.dueAt && access.assignment.dueAt <= new Date()) return NextResponse.json({ error: "The submission deadline has passed" }, { status: 409 });

  const [student] = await db.select({ id: users.id }).from(users).where(eq(users.id, actor.id)).limit(1);
  if (!student) return NextResponse.json({ error: "Student account not found" }, { status: 404 });
  let storageKey: string | undefined;
  let newStoragePath: string | undefined;
  if (file && extension) {
    const id = randomUUID();
    storageKey = id;
    const storageRoot = path.join(process.cwd(), "private_uploads");
    newStoragePath = path.join(storageRoot, `assignment-${id}${extension}`);
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    await writeFile(newStoragePath, Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
  }

  try {
    const result = await db.transaction(async (tx: any) => {
      await tx.select({ id: assignments.id }).from(assignments).where(eq(assignments.id, assignmentId)).for("update").limit(1);
      const [currentAssignment] = await tx.select({ dueAt: assignments.dueAt }).from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
      if (currentAssignment?.dueAt && currentAssignment.dueAt <= new Date()) return { error: "The submission deadline has passed", status: 409 as const };
      const [existing] = await tx.select().from(submissions).where(and(eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, actor.id))).limit(1);
      if (existing?.gradedAt) return { error: "This submission has already been graded and can no longer be changed", status: 409 as const };
      const existingFileUrl = existing?.fileUrl ?? null;
      const id = existing?.id ?? randomUUID();
      const fileUrl = file && extension && storageKey ? `/api/portal/assignments/submissions/${id}/file?ext=${extension}&key=${storageKey}` : existing?.fileUrl ?? null;
      const [saved] = existing
        ? await tx.update(submissions).set({ text: text || null, fileUrl, submittedAt: new Date() }).where(eq(submissions.id, existing.id)).returning({ id: submissions.id })
        : await tx.insert(submissions).values({ id, assignmentId, studentId: actor.id, text: text || null, fileUrl, submittedAt: new Date() }).returning({ id: submissions.id });
      await tx.insert(auditLogs).values({ actorId: actor.id, action: existing ? "resubmit_assignment" : "submit_assignment", entityType: "submission", entityId: saved.id,
        after: { assignmentId, hasText: Boolean(text), hasFile: Boolean(file) } });
      return { id: saved.id, existingFileUrl };
    });
    if ("error" in result) {
      if (newStoragePath) await unlink(newStoragePath).catch(() => undefined);
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    if (result.existingFileUrl && file) {
      const oldExtension = result.existingFileUrl.match(/[?&]ext=(\.[a-z0-9]+)/i)?.[1];
      const oldKey = result.existingFileUrl.match(/[?&]key=([0-9a-f-]{36})/i)?.[1];
      if (oldExtension && oldKey && (oldExtension !== extension || oldKey !== storageKey)) await unlink(path.join(process.cwd(), "private_uploads", `assignment-${oldKey}${oldExtension}`)).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, submission: { id: result.id } });
  } catch (error) {
    if (newStoragePath) await unlink(newStoragePath).catch(() => undefined);
    throw error;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["teacher", "head_academics", "super_admin"].includes(actor.role)) return NextResponse.json({ error: "Academic staff access required" }, { status: 403 });
  const { assignmentId } = await params;
  const access = await assignmentAccess(assignmentId, actor);
  if ("error" in access) return access.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = z.object({ submissionId: z.string().uuid(), score: z.number().int().min(0).max(1000), feedback: z.string().trim().max(3000).optional() }).strict().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.score > (access.assignment.maxScore ?? 100)) return NextResponse.json({ error: `Score cannot exceed ${access.assignment.maxScore ?? 100}` }, { status: 400 });

  const result = await db.transaction(async (tx: any) => {
    const [submission] = await tx.select().from(submissions).where(and(eq(submissions.id, parsed.data.submissionId), eq(submissions.assignmentId, assignmentId))).limit(1);
    if (!submission) return { error: "Submission not found", status: 404 as const };
    const [graded] = await tx.update(submissions).set({ score: parsed.data.score, feedback: parsed.data.feedback || null, gradedAt: new Date() })
      .where(eq(submissions.id, submission.id)).returning({ id: submissions.id });
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "grade_assignment_submission", entityType: "submission", entityId: graded.id,
      before: { score: submission.score, feedback: submission.feedback }, after: { score: parsed.data.score, feedback: parsed.data.feedback || null } });
    return { id: graded.id };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
