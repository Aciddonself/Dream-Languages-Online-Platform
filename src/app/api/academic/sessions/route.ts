import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classes, timetableSessions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";

const schema = z.object({
  title: z.string().trim().min(1).max(160),
  classId: z.string().uuid().optional().or(z.literal("")),
  teacherId: z.string().uuid().optional().or(z.literal("")),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  room: z.string().trim().max(160).optional(),
  meetUrl: z.string().trim().url().optional().or(z.literal("")),
  recurring: z.boolean().default(false),
  recurrenceCount: z.coerce.number().int().min(2).max(52).default(8),
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

  const { title, classId, teacherId, startsAt, endsAt, room, meetUrl, recurring, recurrenceCount } = parsed.data;
  if (startsAt <= new Date()) {
    return NextResponse.json({ error: "Choose a future start time for the class" }, { status: 400 });
  }
  if (endsAt.getTime() - startsAt.getTime() > 12 * 60 * 60_000) {
    return NextResponse.json({ error: "A class session cannot be longer than 12 hours" }, { status: 400 });
  }

  let schoolClass: { id: string; teacherId: string | null } | undefined;
  if (classId) {
    [schoolClass] = await db.select({ id: classes.id, teacherId: classes.teacherId })
      .from(classes).where(eq(classes.id, classId)).limit(1);
    if (!schoolClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  let sessionTeacherId: string | null = null;
  if (user.role === "teacher") {
    if (!schoolClass) {
      return NextResponse.json({ error: "Teachers can only schedule a class they are assigned to" }, { status: 400 });
    }
    if (schoolClass.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only schedule your own assigned classes" }, { status: 403 });
    }
    sessionTeacherId = user.id;
  } else if (teacherId) {
    const [assignedTeacher] = await db.select({ id: users.id, role: users.role, status: users.status, deletedAt: users.deletedAt })
      .from(users).where(eq(users.id, teacherId)).limit(1);
    if (!assignedTeacher || !["teacher", "head_academics"].includes(assignedTeacher.role)
      || !["active", "registered"].includes(assignedTeacher.status) || assignedTeacher.deletedAt) {
      return NextResponse.json({ error: "Choose an active teacher or Head of Academics" }, { status: 400 });
    }
    sessionTeacherId = assignedTeacher.id;
  } else if (schoolClass?.teacherId) {
    const [assignedTeacher] = await db.select({ id: users.id, role: users.role, status: users.status, deletedAt: users.deletedAt })
      .from(users).where(eq(users.id, schoolClass.teacherId)).limit(1);
    if (assignedTeacher && ["teacher", "head_academics"].includes(assignedTeacher.role)
      && ["active", "registered"].includes(assignedTeacher.status) && !assignedTeacher.deletedAt) {
      sessionTeacherId = assignedTeacher.id;
    }
  }

  const assignedTeacherId: string = sessionTeacherId ?? user.id;

  const occurrenceCount = recurring ? recurrenceCount : 1;
  const occurrences = Array.from({ length: occurrenceCount }, (_, index) => ({
    startsAt: new Date(startsAt.getTime() + index * 7 * 24 * 60 * 60_000),
    endsAt: new Date(endsAt.getTime() + index * 7 * 24 * 60 * 60_000),
  }));
  const firstStart = occurrences[0].startsAt;
  const lastEnd = occurrences[occurrences.length - 1].endsAt;
  const matchingAssignments = [eq(timetableSessions.teacherId, assignedTeacherId)];
  if (classId) matchingAssignments.push(eq(timetableSessions.classId, classId));
  const existingSessions = await db.select({ startsAt: timetableSessions.startsAt, endsAt: timetableSessions.endsAt })
    .from(timetableSessions)
    .where(and(
      or(...matchingAssignments),
      lt(timetableSessions.startsAt, lastEnd),
      gt(timetableSessions.endsAt, firstStart),
    ));
  const hasConflict = occurrences.some((occurrence) => existingSessions.some((existing) =>
    occurrence.startsAt < existing.endsAt && occurrence.endsAt > existing.startsAt
  ));
  if (hasConflict) {
    return NextResponse.json({ error: "The selected class or teacher already has a session during that time" }, { status: 409 });
  }

  const sessions = await db
    .insert(timetableSessions)
    .values(occurrences.map((occurrence) => ({
      title,
      classId: classId || null,
      teacherId: assignedTeacherId,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      room: room || null,
      meetUrl: meetUrl || null,
      recurring,
    })))
    .returning({ id: timetableSessions.id, title: timetableSessions.title, meetUrl: timetableSessions.meetUrl });

  return NextResponse.json({ ok: true, session: sessions[0], createdCount: sessions.length }, { status: 201 });
}
