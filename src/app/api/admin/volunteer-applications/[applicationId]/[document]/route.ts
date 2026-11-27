import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, teacherApplications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { deleteTeacherApplicationFile, isTeacherApplicationFileReference, readTeacherApplicationFile, storeTeacherApplicationFile, teacherApplicationFileReference } from "@/lib/teacher-application-files";

const documents = {
  cv: teacherApplications.cvPath,
  "cover-letter": teacherApplications.coverLetterPath,
  recommendation: teacherApplications.recommendationPath,
} as const;
const allowedTypes: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

async function authorizeAdministrator() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  if (user.role !== "super_admin" && user.role !== "admin") return { user: null, response: NextResponse.json({ error: "Administrator access required" }, { status: 403 }) };
  return { user, response: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ applicationId: string; document: string }> }) {
  const { user, response: denied } = await authorizeAdministrator();
  if (denied) return denied;
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { applicationId, document } = await params;
  if (!Object.hasOwn(documents, document)) return NextResponse.json({ error: "Document not found" }, { status: 404 });
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

export async function POST(request: Request, { params }: { params: Promise<{ applicationId: string; document: string }> }) {
  const { user, response: denied } = await authorizeAdministrator();
  if (denied) return denied;
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { applicationId, document } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId) || !Object.hasOwn(documents, document)) {
    return NextResponse.json({ error: "Application or document type is invalid" }, { status: 400 });
  }
  const key = document as keyof typeof documents;
  const [application] = await db.select({ path: documents[key] }).from(teacherApplications).where(eq(teacherApplications.id, applicationId)).limit(1);
  if (!application) return NextResponse.json({ error: "Teacher application not found" }, { status: 404 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Could not read the replacement document upload" }, { status: 400 }); }
  const file = form.get("file");
  const extension = file instanceof File ? allowedTypes[file.type] : undefined;
  if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024 || !extension) {
    return NextResponse.json({ error: "Choose a PDF, DOC, or DOCX file up to 10 MB" }, { status: 400 });
  }

  const objectKey = `${randomUUID()}${extension}`;
  const newReference = teacherApplicationFileReference(objectKey);
  try {
    await storeTeacherApplicationFile(objectKey, new Uint8Array(await file.arrayBuffer()), file.type);
    const updated = await db.transaction(async (tx) => {
      const changed = key === "cv"
        ? await tx.update(teacherApplications).set({ cvPath: newReference }).where(eq(teacherApplications.id, applicationId)).returning({ id: teacherApplications.id })
        : key === "cover-letter"
          ? await tx.update(teacherApplications).set({ coverLetterPath: newReference }).where(eq(teacherApplications.id, applicationId)).returning({ id: teacherApplications.id })
          : await tx.update(teacherApplications).set({ recommendationPath: newReference }).where(eq(teacherApplications.id, applicationId)).returning({ id: teacherApplications.id });
      if (!changed.length) return false;
      await tx.insert(auditLogs).values({ actorId: user.id, action: "replace_teacher_application_document", entityType: "teacher_application", entityId: applicationId, after: { document: key, durable: true } });
      return true;
    });
    if (!updated) {
      await deleteTeacherApplicationFile(newReference);
      return NextResponse.json({ error: "Teacher application was removed before the document could be saved" }, { status: 404 });
    }
    if (application.path && isTeacherApplicationFileReference(application.path)) {
      await deleteTeacherApplicationFile(application.path).catch((error) => console.error("Could not clean up replaced teacher application document", error instanceof Error ? error.name : "UnknownError"));
    }
    return NextResponse.json({ ok: true, message: `${key.replaceAll("-", " ")} saved to durable storage` });
  } catch (error) {
    await deleteTeacherApplicationFile(newReference).catch(() => undefined);
    console.error("Could not replace teacher application document", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "The replacement could not be saved to durable storage. Check Supabase Storage availability and try again." }, { status: 503 });
  }
}
