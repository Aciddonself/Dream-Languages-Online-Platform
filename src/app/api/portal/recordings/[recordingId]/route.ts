import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { classes, classRecordings, enrolments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createMaterialDownload } from "@/lib/class-material-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ recordingId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { recordingId } = await params;
  const [recording] = await db.select().from(classRecordings).where(eq(classRecordings.id, recordingId)).limit(1);
  if (!recording?.storagePath || !recording.uploadComplete) return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  if (user.role === "student") {
    const [enrolment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(
      eq(enrolments.studentId, user.id), eq(enrolments.classId, recording.classId), eq(enrolments.status, "active"),
    )).limit(1);
    if (!enrolment) return NextResponse.json({ error: "You are not enrolled in this class" }, { status: 403 });
  } else if (user.role === "teacher") {
    const [schoolClass] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, recording.classId), eq(classes.teacherId, user.id))).limit(1);
    if (!schoolClass) return NextResponse.json({ error: "You cannot access this class recording" }, { status: 403 });
  } else if (!["super_admin", "head_academics"].includes(user.role)) {
    return NextResponse.json({ error: "Portal access required" }, { status: 403 });
  }
  const signedUrl = await createMaterialDownload(recording.storagePath);
  return NextResponse.redirect(signedUrl, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
