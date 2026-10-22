import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, enrolments, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isProfilePhotoJpeg } from "@/lib/pdf";

export const runtime = "nodejs";

const types: Record<string, { extension: string; contentType: string }> = {
  "image/jpeg": { extension: ".jpg", contentType: "image/jpeg" },
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get("userId");
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
  const file = await readFile(path.join(process.cwd(), "private_uploads", photoOwner.avatarStorageKey));
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
    return NextResponse.json({ error: "Upload a JPG, PNG, or WebP image up to 5 MB through the profile photo form" }, { status: 400 });
  }
  const photoBytes = Buffer.from(await photo.arrayBuffer());
  if (!isProfilePhotoJpeg(photoBytes)) return NextResponse.json({ error: "The profile photo could not be read as a JPEG. Please reselect the image and try again." }, { status: 415 });
  const key = `${randomUUID()}${types[photo.type].extension}`;
  const root = path.join(process.cwd(), "private_uploads");
  await mkdir(root, { recursive: true, mode: 0o700 });
  await writeFile(path.join(root, key), photoBytes, { flag: "wx", mode: 0o600 });
  try {
    await db.update(users).set({ avatarStorageKey: key, avatarUrl: "/api/portal/profile-photo", updatedAt: new Date() }).where(eq(users.id, user.id));
  } catch (error) {
    try {
      await unlink(path.join(root, key));
    } catch (cleanupError) {
      console.error("Could not clean up failed profile photo upload:", cleanupError);
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
