import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { assignments, classes, enrolments, submissions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { readAssignmentFile } from "@/lib/assignment-storage";

export const runtime = "nodejs";

const mimeByExtension: Record<string, string> = {
  ".pdf": "application/pdf", ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain", ".csv": "text/csv", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".weba": "audio/webm",
};

export async function GET(_request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { submissionId } = await params;
  const [row] = await db.select({
    studentId: submissions.studentId, fileUrl: submissions.fileUrl,
    classId: assignments.classId, teacherId: assignments.teacherId,
  }).from(submissions).innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(eq(submissions.id, submissionId)).limit(1);
  if (!row?.fileUrl || !row.classId) return NextResponse.json({ error: "Submission file not found" }, { status: 404 });

  if (actor.role === "student") {
    if (row.studentId !== actor.id) return NextResponse.json({ error: "You can only download your own submission" }, { status: 403 });
    const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(eq(enrolments.studentId, actor.id), eq(enrolments.classId, row.classId), eq(enrolments.status, "active"))).limit(1);
    if (!enrollment) return NextResponse.json({ error: "Active class enrollment is required" }, { status: 403 });
  } else if (actor.role === "teacher") {
    if (row.teacherId !== actor.id) return NextResponse.json({ error: "You cannot access this submission" }, { status: 403 });
  } else if (!["head_academics", "super_admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Academic portal access required" }, { status: 403 });
  }

  const extension = row.fileUrl.match(/[?&]ext=(\.[a-z0-9]+)/i)?.[1]?.toLowerCase();
  const key = row.fileUrl.match(/[?&]key=([0-9a-f-]{36})/i)?.[1];
  if (!extension || !mimeByExtension[extension] || !key) return NextResponse.json({ error: "Submission file is unavailable" }, { status: 404 });
  let content: Uint8Array;
  try { content = await readAssignmentFile(key, extension); }
  catch { return NextResponse.json({ error: "Submission file is not available" }, { status: 404 }); }
  return new Response(new Uint8Array(content), { headers: {
    "Content-Type": mimeByExtension[extension],
    "Content-Disposition": `attachment; filename="assignment-submission${extension}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  } });
}
