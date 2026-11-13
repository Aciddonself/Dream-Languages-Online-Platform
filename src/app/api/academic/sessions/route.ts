import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classes, timetableSessions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { createGoogleCalendarMeet, deleteGoogleCalendarEvent } from "@/lib/google-calendar";

const dateInKampala = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" });
function kampalaDayKey(date: Date) {
  const parts = dateInKampala.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const schema = z.object({
  title: z.string().trim().min(1).max(160),
  classId: z.string().uuid().optional().or(z.literal("")),
  teacherId: z.string().uuid().optional().or(z.literal("")),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  room: z.string().trim().max(160).optional(),
  meetUrl: z.string().trim().url().optional().or(z.literal("")),
  generateMeet: z.boolean().default(false),
  recurring: z.boolean().default(false),
  recurrenceUntil: z.coerce.date().optional(),
}).refine((data) => data.endsAt > data.startsAt, {
  message: "Session end must be after its start",
  path: ["endsAt"],
}).refine((data) => !data.meetUrl || new URL(data.meetUrl).hostname === "meet.google.com", {
  message: "Enter a Google Meet URL from meet.google.com",
  path: ["meetUrl"],
}).refine((data) => !data.recurring || Boolean(data.recurrenceUntil), {
  message: "Choose the last date for this weekly class series.",
  path: ["recurrenceUntil"],
}).refine((data) => !data.recurring || !data.recurrenceUntil || data.recurrenceUntil.toISOString().slice(0, 10) >= kampalaDayKey(data.startsAt), {
  message: "The repeat-until date must be on or after the first class.",
  path: ["recurrenceUntil"],
}).refine((data) => !data.recurring || !data.recurrenceUntil || data.recurrenceUntil.getTime() - data.startsAt.getTime() <= 366 * 24 * 60 * 60_000, {
  message: "Weekly class series can run for up to one year.",
  path: ["recurrenceUntil"],
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

  const { title, classId, teacherId, startsAt, endsAt, room, recurring, recurrenceUntil } = parsed.data;
  let meetUrl = parsed.data.meetUrl || "";
  let calendarEvent: Awaited<ReturnType<typeof createGoogleCalendarMeet>> | null = null;

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

  if (parsed.data.generateMeet && !meetUrl) {
    try {
      calendarEvent = await createGoogleCalendarMeet({
        title,
        startsAt,
        endsAt,
        recurrenceUntil: recurring ? recurrenceUntil : undefined,
        description: ["Dream Languages Uganda online class.", room ? `Location: ${room}` : ""].filter(Boolean).join("\n"),
      });
      meetUrl = calendarEvent.meetUrl;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Google Meet creation failed." }, { status: 502 });
    }
  }

  const occurrences: { startsAt: Date; endsAt: Date }[] = [{ startsAt, endsAt }];
  if (recurring && recurrenceUntil) {
    const untilDay = recurrenceUntil.toISOString().slice(0, 10);
    while (occurrences.length < 53) {
      const nextStart = new Date(occurrences[occurrences.length - 1].startsAt.getTime() + 7 * 24 * 60 * 60_000);
      const nextDay = kampalaDayKey(nextStart);
      if (nextDay > untilDay) break;
      occurrences.push({ startsAt: nextStart, endsAt: new Date(occurrences[occurrences.length - 1].endsAt.getTime() + 7 * 24 * 60 * 60_000) });
    }
  }

  try {
    const sessions = await db.insert(timetableSessions).values(occurrences.map((occurrence) => ({
      title,
      classId: classId || null,
      teacherId: sessionTeacherId || user.id,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      room: room || null,
      meetUrl: meetUrl || null,
      recurring,
    }))).returning({ id: timetableSessions.id, title: timetableSessions.title, startsAt: timetableSessions.startsAt, meetUrl: timetableSessions.meetUrl });
    return NextResponse.json({ ok: true, session: sessions[0], sessions, calendarEventUrl: calendarEvent?.calendarEventUrl ?? null }, { status: 201 });
  } catch (error) {
    if (calendarEvent?.calendarEventId) {
      await deleteGoogleCalendarEvent(calendarEvent.calendarEventId).catch((cleanupError) => console.error("Google Calendar cleanup failed after LMS save failed:", cleanupError instanceof Error ? cleanupError.message : "unknown error"));
    }
    throw error;
  }

}
