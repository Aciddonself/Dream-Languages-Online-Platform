import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classes, timetableSessions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

const schema = z.object({
  title: z.string().trim().min(1).max(160),
  classId: z.string().uuid().optional().or(z.literal("")),
  teacherId: z.string().uuid().optional().or(z.literal("")),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  room: z.string().trim().max(160).optional(),
  meetUrl: z.string().trim().url().optional().or(z.literal("")),
  recurring: z.boolean().default(false),
}).refine((data) => data.endsAt > data.startsAt, {
  message: "Session end must be after its start",
  path: ["endsAt"],
}).refine((data) => !data.meetUrl || new URL(data.meetUrl).hostname === "meet.google.com", {
  message: "Enter a Google Meet URL from meet.google.com",
  path: ["meetUrl"],
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["super_admin", "head_academics", "teacher"].includes(user.role)) {
    return NextResponse.json({ error: "Academic scheduling access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { title, classId, teacherId, startsAt, endsAt, room, meetUrl, recurring } = parsed.data;

  let sessionTeacherId: string | null = null;

  if (user.role === "teacher") {
    sessionTeacherId = user.id;
  } else if (teacherId) {
    // Validate provided teacherId exists and is a teacher or academic head
    const [assignedTeacher] = await db.select().from(users).where(eq(users.id, teacherId)).limit(1);
    sessionTeacherId = assignedTeacher?.id ?? user.id;
  }

  if (classId) {
    const [schoolClass] = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
    if (!schoolClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
    if (user.role === "teacher" && schoolClass.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only schedule your own classes" }, { status: 403 });
    }
    if (!sessionTeacherId) {
      sessionTeacherId = schoolClass.teacherId ?? user.id;
    }
  }

  const [session] = await db
    .insert(timetableSessions)
    .values({
      title,
      classId: classId || null,
      teacherId: sessionTeacherId || user.id,
      startsAt,
      endsAt,
      room: room || null,
      meetUrl: meetUrl || null,
      recurring,
    })
    .returning({ id: timetableSessions.id, title: timetableSessions.title, meetUrl: timetableSessions.meetUrl });

  return NextResponse.json({ ok: true, session }, { status: 201 });
}
