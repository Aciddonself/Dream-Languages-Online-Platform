import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { announcements, auditLogs, classes, departments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { detectPhoneOrHandle } from "@/lib/phone-filter";
import { notifySchoolAudience } from "@/lib/notification-delivery";

const schema = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(5000),
  audience: z.enum(["all", "language", "class"]),
  classId: z.string().uuid().optional().or(z.literal("")),
  departmentId: z.string().uuid().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["teacher", "head_academics", "super_admin", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Academic staff access required" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (/\bholidays?\b/i.test(`${parsed.data.title} ${parsed.data.body}`)) {
    return NextResponse.json({ error: "Holiday announcements must be submitted as a draft for administrator or Head of Academics approval." }, { status: 400 });
  }
  if (detectPhoneOrHandle(`${parsed.data.title} ${parsed.data.body}`).blocked) {
    return NextResponse.json({ error: "Announcements cannot contain personal phone numbers or contact handles." }, { status: 400 });
  }
  const classId = parsed.data.classId || null;
  const departmentId = parsed.data.departmentId || null;
  if (parsed.data.audience === "all" && user.role === "teacher") {
    return NextResponse.json({ error: "Teachers cannot send announcements to all enrolled students" }, { status: 403 });
  }
  if (parsed.data.audience === "class" && !classId) return NextResponse.json({ error: "Select a class for this announcement" }, { status: 400 });
  if (parsed.data.audience === "language" && !departmentId) return NextResponse.json({ error: "Select a language for this announcement" }, { status: 400 });
  if ((parsed.data.audience === "class" && departmentId) || (parsed.data.audience === "language" && classId) || (parsed.data.audience === "all" && (classId || departmentId))) {
    return NextResponse.json({ error: "Choose only one announcement audience" }, { status: 400 });
  }
  if (classId) {
    const [schoolClass] = await db.select({ id: classes.id, teacherId: classes.teacherId }).from(classes).where(and(eq(classes.id, classId), isNull(classes.deletedAt))).limit(1);
    if (!schoolClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
    if (user.role === "teacher" && schoolClass.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only post announcements to your own classes" }, { status: 403 });
    }
  }
  if (departmentId) {
    const [language] = await db.select({ id: departments.id }).from(departments).where(and(
      eq(departments.id, departmentId), eq(departments.isLanguage, true), isNull(departments.deletedAt),
    )).limit(1);
    if (!language) return NextResponse.json({ error: "Language programme not found" }, { status: 404 });
    if (user.role === "teacher") {
      const [teachingClass] = await db.select({ id: classes.id }).from(classes).where(and(
        eq(classes.teacherId, user.id), eq(classes.departmentId, departmentId), isNull(classes.deletedAt),
      )).limit(1);
      if (!teachingClass) return NextResponse.json({ error: "You can only address learners in a language you teach" }, { status: 403 });
    }
  }
  const [announcement] = await db.insert(announcements).values({
    title: parsed.data.title,
    body: parsed.data.body,
    audience: parsed.data.audience,
    classId,
    departmentId,
    createdBy: user.id,
  }).returning({ id: announcements.id, title: announcements.title });
  await db.insert(auditLogs).values({
    actorId: user.id,
    action: "publish_announcement",
    entityType: "announcement",
    entityId: announcement.id,
    after: { title: announcement.title, audience: parsed.data.audience, classId, departmentId },
  });
  let notifiedCount = 0;
  try {
    notifiedCount = await notifySchoolAudience({
      title: `School announcement: ${announcement.title}`,
      body: parsed.data.body,
      audience: parsed.data.audience,
      departmentId,
      classId,
      excludeUserId: user.id,
    });
  } catch (error) {
    console.error("Announcement was saved, but notifications could not be delivered", error instanceof Error ? error.message : "unknown error");
  }
  return NextResponse.json({ ok: true, announcement, notifiedCount }, { status: 201 });
}
