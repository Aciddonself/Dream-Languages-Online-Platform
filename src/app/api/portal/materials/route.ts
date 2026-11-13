import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { classes, materials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { classMaterialExists, createMaterialUpload, MATERIAL_TYPES, removeClassMaterial } from "@/lib/class-material-storage";

export const runtime = "nodejs";
const MAX_MATERIAL_BYTES = 250 * 1024 * 1024;

const createSchema = z.object({
  action: z.literal("create_upload"),
  classId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().default(""),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().min(3).max(128),
  fileSizeBytes: z.number().int().positive().max(MAX_MATERIAL_BYTES),
}).strict();
const completeSchema = z.object({ action: z.literal("complete_upload"), materialId: z.string().uuid() }).strict();

async function getUploader() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  if (!["teacher", "head_academics", "super_admin"].includes(user.role)) {
    return { error: NextResponse.json({ error: "Teacher or academic administrator access required" }, { status: 403 }) };
  }
  return { user };
}

export async function POST(request: Request) {
  const auth = await getUploader();
  if (auth.error) return auth.error;
  const { user } = auth;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || !("action" in body)) return NextResponse.json({ error: "Choose an upload action" }, { status: 400 });

  if ((body as { action?: string }).action === "complete_upload") {
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const [material] = await db.select().from(materials).where(and(eq(materials.id, parsed.data.materialId), eq(materials.teacherId, user.id))).limit(1);
    if (!material || !material.storagePath) return NextResponse.json({ error: "Upload record not found" }, { status: 404 });
    if (material.uploadComplete) return NextResponse.json({ ok: true });
    if (!(await classMaterialExists(material.storagePath))) return NextResponse.json({ error: "The uploaded file was not found. Try uploading it again." }, { status: 409 });
    await db.update(materials).set({ uploadComplete: true }).where(eq(materials.id, material.id));
    return NextResponse.json({ ok: true });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const extension = MATERIAL_TYPES[input.contentType];
  if (!extension) return NextResponse.json({ error: "Use a supported document, audio, or video format" }, { status: 415 });
  if (!input.fileName.toLowerCase().endsWith(extension) && !(input.contentType === "text/plain" && input.fileName.toLowerCase().endsWith(".log"))) {
    return NextResponse.json({ error: "The file extension does not match its selected format" }, { status: 415 });
  }
  const [schoolClass] = await db.select({ id: classes.id, teacherId: classes.teacherId }).from(classes).where(eq(classes.id, input.classId)).limit(1);
  if (!schoolClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (user.role === "teacher" && schoolClass.teacherId !== user.id) return NextResponse.json({ error: "You can only upload materials to your own classes" }, { status: 403 });

  const id = randomUUID();
  const storagePath = `${user.id}/${id}${extension}`;
  const upload = await createMaterialUpload(storagePath);
  await db.insert(materials).values({
    id,
    classId: input.classId,
    teacherId: user.id,
    title: input.title,
    description: input.description || null,
    fileUrl: `/api/portal/materials/${id}`,
    type: input.contentType,
    storagePath,
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    uploadComplete: false,
  });
  return NextResponse.json({ ok: true, materialId: id, path: upload.path, token: upload.token }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["teacher", "head_academics", "super_admin"].includes(user.role)) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const id = z.string().uuid().safeParse((body as { materialId?: unknown })?.materialId);
  if (!id.success) return NextResponse.json({ error: "Invalid material" }, { status: 400 });
  const [material] = await db.select().from(materials).where(eq(materials.id, id.data)).limit(1);
  if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });
  if (user.role === "teacher" && material.teacherId !== user.id) return NextResponse.json({ error: "You can only delete your own materials" }, { status: 403 });
  if (material.storagePath) await removeClassMaterial(material.storagePath);
  else {
    const extension = MATERIAL_TYPES[material.type ?? ""];
    if (extension) await unlink(path.join(process.cwd(), "private_uploads", `${material.id}${extension}`)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  }
  await db.delete(materials).where(eq(materials.id, material.id));
  return NextResponse.json({ ok: true });
}
