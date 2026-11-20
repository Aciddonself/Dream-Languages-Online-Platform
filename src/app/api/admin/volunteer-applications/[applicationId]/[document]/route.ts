import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teacherApplications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isTeacherApplicationFileReference, readTeacherApplicationFile } from "@/lib/teacher-application-files";

const documents = {
  cv: teacherApplications.cvPath,
  "cover-letter": teacherApplications.coverLetterPath,
  recommendation: teacherApplications.recommendationPath,
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ applicationId: string; document: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if ((user.role !== "super_admin" && user.role !== "admin")) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  const { applicationId, document } = await params;
  if (!(document in documents)) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const key = document as keyof typeof documents;
  const [application] = await db.select({ path: documents[key] }).from(teacherApplications).where(eq(teacherApplications.id, applicationId)).limit(1);
  if (!application?.path) return NextResponse.json({ error: "Application document not found" }, { status: 404 });
  let file: Buffer;
  try {
    file = isTeacherApplicationFileReference(application.path)
      ? Buffer.from(await readTeacherApplicationFile(application.path))
      : await readFile(application.path);
  } catch (error) {
    const detail = error && typeof error === "object" ? error as { name?: string; code?: string; statusCode?: string | null } : {};
    console.error("Teacher application document unavailable", {
      applicationId,
      document,
      errorName: detail.name ?? "Error",
      errorCode: detail.code ?? "unknown",
      storageStatus: detail.statusCode ?? null,
    });
    return NextResponse.json({ error: "This document is not available in durable storage. Ask the applicant to upload it again.", code: "TEACHER_APPLICATION_DOCUMENT_UNAVAILABLE" }, { status: 404 });
  }
  const extension = application.path.split(".").pop()?.toLowerCase();
  const contentType = extension === "pdf" ? "application/pdf" : extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/msword";
  const body = new ArrayBuffer(file.byteLength);
  new Uint8Array(body).set(file);
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="teacher-application-${document}.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
