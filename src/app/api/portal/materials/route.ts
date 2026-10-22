import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, materials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const allowedTypes: Record<string, string> = {
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

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["teacher", "head_academics", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Teacher or academic administrator access required" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded form" }, { status: 400 });
  }
  const classId = String(form.get("classId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(classId)) return NextResponse.json({ error: "Select a valid class" }, { status: 400 });
  if (!title || title.length > 160) return NextResponse.json({ error: "Title must be between 1 and 160 characters" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a document to upload" }, { status: 400 });
  if (file.size < 1 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Document size must be less than 25 MB" }, { status: 400 });
  const extension = allowedTypes[file.type];
  if (!extension) return NextResponse.json({ error: "Use a PDF, Word, Excel, PowerPoint, CSV, or plain text document" }, { status: 415 });

  const [schoolClass] = await db.select({ id: classes.id, teacherId: classes.teacherId }).from(classes).where(eq(classes.id, classId)).limit(1);
  if (!schoolClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (user.role === "teacher" && schoolClass.teacherId !== user.id) {
    return NextResponse.json({ error: "You can only upload materials to your own classes" }, { status: 403 });
  }

  const id = randomUUID();
  const storageRoot = path.join(process.cwd(), "private_uploads");
  const storagePath = path.join(storageRoot, `${id}${extension}`);
  await mkdir(storageRoot, { recursive: true, mode: 0o700 });
  await writeFile(storagePath, Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
  try {
    const [material] = await db.insert(materials).values({
      id,
      classId,
      teacherId: user.id,
      title,
      description: description.slice(0, 2000) || null,
      fileUrl: `/api/portal/materials/${id}`,
      type: file.type,
    }).returning({ id: materials.id, title: materials.title });
    return NextResponse.json({ ok: true, material }, { status: 201 });
  } catch (error) {
    try {
      await unlink(storagePath);
    } catch (cleanupError) {
      console.error("Failed to remove an unregistered class document:", { id, cleanupError });
    }
    throw error;
  }
}
