import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teacherApplications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const documents = {
  cv: teacherApplications.cvPath,
  "cover-letter": teacherApplications.coverLetterPath,
  recommendation: teacherApplications.recommendationPath,
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ applicationId: string; document: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "super_admin") return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  const { applicationId, document } = await params;
  if (!(document in documents)) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const key = document as keyof typeof documents;
  const [application] = await db.select({ path: documents[key] }).from(teacherApplications).where(eq(teacherApplications.id, applicationId)).limit(1);
  if (!application?.path) return NextResponse.json({ error: "Application document not found" }, { status: 404 });
  const file = await readFile(application.path);
  const extension = application.path.split(".").pop()?.toLowerCase();
  const contentType = extension === "pdf" ? "application/pdf" : extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/msword";
  return new Response(file, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="teacher-application-${document}.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
