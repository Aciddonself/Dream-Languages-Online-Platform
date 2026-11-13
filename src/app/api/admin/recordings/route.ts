import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classes, classRecordings, timetableSessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createMaterialUpload, classMaterialExists, removeClassMaterial } from "@/lib/class-material-storage";

export const runtime = "nodejs";
const MAX_RECORDING_BYTES = 250 * 1024 * 1024;
const createSchema = z.object({
  action: z.literal("create_upload"),
  classId: z.string().uuid(),
  sessionId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).optional().default(""),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
  fileSizeBytes: z.number().int().positive().max(MAX_RECORDING_BYTES),
}).strict();
const completeSchema = z.object({ action: z.literal("complete_upload"), recordingId: z.string().uuid() }).strict();

async function admin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  if (user.role !== "super_admin") return { error: NextResponse.json({ error: "Only a super administrator can manage class recordings" }, { status: 403 }) };
  return { user };
}

export async function POST(request: Request) {
  const auth = await admin();
  if (auth.error) return auth.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  if (body && typeof body === "object" && "action" in body && body.action === "complete_upload") {
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const [recording] = await db.select().from(classRecordings).where(eq(classRecordings.id, parsed.data.recordingId)).limit(1);
    if (!recording?.storagePath) return NextResponse.json({ error: "Recording upload not found" }, { status: 404 });
    if (recording.uploadComplete) return NextResponse.json({ ok: true });
    if (!(await classMaterialExists(recording.storagePath))) return NextResponse.json({ error: "Uploaded video was not found. Try again." }, { status: 409 });
    await db.update(classRecordings).set({ uploadComplete: true }).where(eq(classRecordings.id, recording.id));
    return NextResponse.json({ ok: true });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const extension = { "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov" }[input.contentType];
  if (!input.fileName.toLowerCase().endsWith(extension)) return NextResponse.json({ error: "File extension must match the selected video format" }, { status: 415 });
  const [schoolClass] = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, input.classId)).limit(1);
  if (!schoolClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (input.sessionId) {
    const [session] = await db.select({ id: timetableSessions.id, classId: timetableSessions.classId }).from(timetableSessions)
      .where(and(eq(timetableSessions.id, input.sessionId), eq(timetableSessions.classId, input.classId))).limit(1);
    if (!session) return NextResponse.json({ error: "Choose a scheduled session from the selected class" }, { status: 400 });
  }
  const id = randomUUID();
  const storagePath = `recordings/${id}${extension}`;
  const upload = await createMaterialUpload(storagePath);
  await db.insert(classRecordings).values({
    id, classId: input.classId, sessionId: input.sessionId || null, title: input.title,
    description: input.description || null, recordingUrl: `/api/portal/recordings/${id}`,
    storagePath, fileName: input.fileName, external: false, uploadComplete: false, addedBy: auth.user.id,
  });
  return NextResponse.json({ recordingId: id, path: upload.path, token: upload.token }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await admin();
  if (auth.error) return auth.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = z.object({ recordingId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [recording] = await db.select().from(classRecordings).where(eq(classRecordings.id, parsed.data.recordingId)).limit(1);
  if (!recording) return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  if (recording.storagePath) await removeClassMaterial(recording.storagePath);
  await db.delete(classRecordings).where(eq(classRecordings.id, recording.id));
  return NextResponse.json({ ok: true });
}
