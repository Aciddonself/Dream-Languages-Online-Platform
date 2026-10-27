import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, auditLogs, classes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { detectPhoneOrHandle } from "@/lib/phone-filter";

const schema = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(5000),
  classId: z.string().uuid().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["teacher", "head_academics", "super_admin"].includes(user.role)) {
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
  if (!classId && user.role === "teacher") {
    return NextResponse.json({ error: "Teachers can only make announcements to a class they teach" }, { status: 403 });
  }
  if (classId) {
    const [schoolClass] = await db.select({ id: classes.id, teacherId: classes.teacherId }).from(classes).where(eq(classes.id, classId)).limit(1);
    if (!schoolClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
    if (user.role === "teacher" && schoolClass.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only post announcements to your own classes" }, { status: 403 });
    }
  }
  const [announcement] = await db.insert(announcements).values({
    title: parsed.data.title,
    body: parsed.data.body,
    audience: classId ? "class" : "all",
    classId,
    createdBy: user.id,
  }).returning({ id: announcements.id, title: announcements.title });
  await db.insert(auditLogs).values({
    actorId: user.id,
    action: "publish_announcement",
    entityType: "announcement",
    entityId: announcement.id,
    after: { title: announcement.title, classId },
  });
  return NextResponse.json({ ok: true, announcement }, { status: 201 });
}
