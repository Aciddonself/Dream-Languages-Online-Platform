import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, enrolments, materials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const extensionByType: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "text/plain": ".txt",
  "text/csv": ".csv",
};

export async function GET(_request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { materialId } = await params;
  const [material] = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
  if (!material?.classId || !material.fileUrl || !material.type) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (user.role === "student") {
    const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(
      eq(enrolments.studentId, user.id),
      eq(enrolments.classId, material.classId),
      eq(enrolments.status, "active"),
    )).limit(1);
    if (!enrollment) return NextResponse.json({ error: "You are not enrolled in this class" }, { status: 403 });
  } else if (user.role === "teacher") {
    const [schoolClass] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, material.classId), eq(classes.teacherId, user.id))).limit(1);
    if (!schoolClass) return NextResponse.json({ error: "You cannot access this class document" }, { status: 403 });
  } else if (!["student", "teacher", "head_academics", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Portal access required" }, { status: 403 });
  }

  const extension = extensionByType[material.type];
  if (!extension) return NextResponse.json({ error: "Unsupported document type" }, { status: 415 });
  const storagePath = path.join(process.cwd(), "private_uploads", `${material.id}${extension}`);
  let content: Buffer;
  try {
    content = await readFile(storagePath);
  } catch (error) {
    console.error("Class material is missing from private storage:", { materialId: material.id, error });
    return NextResponse.json({ error: "The document is not available on this server" }, { status: 500 });
  }
  const safeTitle = material.title.replace(/[^\w -]/g, "").trim().slice(0, 100) || "class-material";
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": material.type,
      "Content-Disposition": `attachment; filename="${safeTitle}${extension}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
