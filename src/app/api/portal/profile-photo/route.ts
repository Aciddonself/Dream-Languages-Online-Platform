import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, classes, enrolments, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isProfilePhotoJpeg } from "@/lib/pdf";
import { clientIp } from "@/lib/rate-limit";
import { deleteStudentPhoto, readStudentPhoto, storeStudentPhoto } from "@/lib/student-photos";

export const runtime = "nodejs";

const types: Record<string, { extension: string; contentType: string }> = {
  "image/jpeg": { extension: ".jpg", contentType: "image/jpeg" },
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get("userId");
  if (requestedUserId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedUserId)) {
    return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
  }
  let photoOwner = user;
  if (requestedUserId && requestedUserId !== user.id) {
    if (!["teacher", "head_academics", "super_admin"].includes(user.role)) return NextResponse.json({ error: "Profile photo access denied" }, { status: 403 });
    const classId = url.searchParams.get("classId");
    if (user.role === "teacher") {
      if (!classId) return NextResponse.json({ error: "Class context required" }, { status: 400 });
      const [schoolClass] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, classId), eq(classes.teacherId, user.id))).limit(1);
      if (!schoolClass) return NextResponse.json({ error: "You are not assigned to this class" }, { status: 403 });
      const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments)
        .where(and(eq(enrolments.classId, classId), eq(enrolments.studentId, requestedUserId), eq(enrolments.status, "active"))).limit(1);
      if (!enrollment) return NextResponse.json({ error: "Student is not enrolled in this class" }, { status: 403 });
    }
    const [student] = await db.select().from(users).where(and(eq(users.id, requestedUserId), eq(users.role, "student"))).limit(1);
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    photoOwner = student;
  }
  if (!photoOwner.avatarStorageKey || !/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(photoOwner.avatarStorageKey)) {
    return NextResponse.json({ error: "No profile photo is available" }, { status: 404 });
  }
  const file = await readStudentPhoto(photoOwner.avatarStorageKey);
  const extension = photoOwner.avatarStorageKey.split(".").pop();
  const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return new Response(file, { headers: { "Content-Type": contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the profile photo upload" }, { status: 400 });
  }
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size < 1 || photo.size > 5 * 1024 * 1024 || !types[photo.type]) {
    return NextResponse.json({ error: "Choose a JPG, PNG, or WebP image up to 5 MB through the profile photo form" }, { status: 400 });
  }
  const photoBytes = Buffer.from(await photo.arrayBuffer());
  if (!isProfilePhotoJpeg(photoBytes)) return NextResponse.json({ error: "The profile photo could not be read as a JPEG. Please reselect the image and try again." }, { status: 415 });
  const requestedUserId = form.get("userId");
  if (requestedUserId !== null && (typeof requestedUserId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedUserId))) {
    return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
  }
  let photoOwnerId = user.id;
  let oldKey = user.avatarStorageKey;
  if (typeof requestedUserId === "string" && requestedUserId !== user.id) {
    if (user.role !== "super_admin") return NextResponse.json({ error: "Administrator access is required to upload another user's photo" }, { status: 403 });
    const [target] = await db.select({ id: users.id, role: users.role, avatarStorageKey: users.avatarStorageKey })
      .from(users)
      .where(and(
        eq(users.id, requestedUserId),
        isNull(users.deletedAt),
      ))
      .limit(1);
    if (!target) return NextResponse.json({ error: "Student or applicant account not found" }, { status: 404 });
    if (!["student", "applicant"].includes(target.role)) {
      return NextResponse.json({ error: "Photos can only be uploaded to student or applicant accounts" }, { status: 403 });
    }
    photoOwnerId = target.id;
    oldKey = target.avatarStorageKey;
  } else if (typeof requestedUserId === "string" && requestedUserId === user.id) {
    photoOwnerId = user.id;
  }
  const key = `${randomUUID()}${types[photo.type].extension}`;
  await storeStudentPhoto(key, photoBytes);
  try {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ avatarStorageKey: key, avatarUrl: "/api/portal/profile-photo", updatedAt: new Date() }).where(eq(users.id, photoOwnerId));
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: photoOwnerId === user.id ? "update_profile_photo" : "update_student_photo",
        entityType: "user",
        entityId: photoOwnerId,
        after: { hasPassportPhoto: true },
        ip: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      });
    });
  } catch (error) {
    try {
      await deleteStudentPhoto(key);
    } catch (cleanupError) {
      console.error("Could not clean up failed profile photo upload:", cleanupError);
    }
    throw error;
  }
  if (oldKey && oldKey !== key) {
    try {
      await deleteStudentPhoto(oldKey);
    } catch (cleanupError) {
      console.error("Could not clean up replaced profile photo:", cleanupError);
    }
  }
  return NextResponse.json({ ok: true });
}
