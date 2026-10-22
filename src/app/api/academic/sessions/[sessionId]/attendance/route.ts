import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attendance, auditLogs, classes, enrolments, timetableSessions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { calculateAttendancePercent } from "@/lib/attendance";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["start", "end", "check_in", "check_out", "confirm", "mark_absent", "correct"]),
  studentId: z.string().uuid().optional(),
  status: z.enum(["present", "absent"]).optional(),
  checkInAt: z.coerce.date().optional(),
  checkOutAt: z.coerce.date().optional(),
  reason: z.string().trim().max(1000).optional(),
});

type RouteContext = { params: Promise<{ sessionId: string }> };
async function canManageSession(userId: string, role: string, session: { teacherId: string | null; classId: string | null }) {
  if (role === "super_admin" || role === "head_academics") return true;
  if (role !== "teacher") return false;
  if (session.teacherId === userId) return true;
  if (!session.classId) return false;
  const [schoolClass] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, session.classId), eq(classes.teacherId, userId))).limit(1);
  return Boolean(schoolClass);
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { sessionId } = await params;
  const [session] = await db.select().from(timetableSessions).where(eq(timetableSessions.id, sessionId)).limit(1);
  if (!session) return NextResponse.json({ error: "Class session not found" }, { status: 404 });

  if (user.role === "student") {
    if (!session.classId) return NextResponse.json({ error: "This session has no enrolled class" }, { status: 403 });
    const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(eq(enrolments.studentId, user.id), eq(enrolments.classId, session.classId))).limit(1);
    if (!enrollment) return NextResponse.json({ error: "You are not enrolled in this class" }, { status: 403 });
    const [record] = await db.select().from(attendance).where(and(eq(attendance.sessionId, session.id), eq(attendance.studentId, user.id))).limit(1);
    const completedSessions = await db
      .select({ id: timetableSessions.id, startsAt: timetableSessions.startsAt, endsAt: timetableSessions.endsAt })
      .from(timetableSessions)
      .where(and(eq(timetableSessions.classId, session.classId), isNotNull(timetableSessions.liveEndedAt)));
    const completedIds = completedSessions.map((item) => item.id);
    const history = completedIds.length
      ? await db.select({
          sessionId: attendance.sessionId,
          studentId: attendance.studentId,
          status: attendance.status,
          checkInAt: attendance.checkInAt,
          checkOutAt: attendance.checkOutAt,
        }).from(attendance).where(inArray(attendance.sessionId, completedIds))
      : [];
    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        liveStartedAt: session.liveStartedAt,
        liveEndedAt: session.liveEndedAt,
      },
      attendance: record ? {
        status: record.status,
        checkInAt: record.checkInAt,
        checkOutAt: record.checkOutAt,
        confirmedAt: record.confirmedAt,
      } : null,
      attendancePercent: calculateAttendancePercent(completedSessions, history, user.id),
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (!(await canManageSession(user.id, user.role, session))) {
    return NextResponse.json({ error: "You cannot view attendance for this class" }, { status: 403 });
  }
  const roster = session.classId
    ? await db
        .select({
          studentId: enrolments.studentId,
          name: users.displayName,
          firstName: users.firstName,
          lastName: users.lastName,
          avatarUrl: users.avatarStorageKey,
          attendanceId: attendance.id,
          status: attendance.status,
          checkInAt: attendance.checkInAt,
          checkOutAt: attendance.checkOutAt,
          confirmedAt: attendance.confirmedAt,
        })
        .from(enrolments)
        .innerJoin(users, eq(enrolments.studentId, users.id))
        .leftJoin(attendance, and(eq(attendance.sessionId, session.id), eq(attendance.studentId, enrolments.studentId)))
        .where(and(eq(enrolments.classId, session.classId), eq(enrolments.status, "active")))
        .orderBy(users.firstName)
    : [];
  const completedSessions = session.classId
    ? await db
        .select({ id: timetableSessions.id, startsAt: timetableSessions.startsAt, endsAt: timetableSessions.endsAt })
        .from(timetableSessions)
        .where(and(eq(timetableSessions.classId, session.classId), isNotNull(timetableSessions.liveEndedAt)))
    : [];
  const completedIds = completedSessions.map((item) => item.id);
  const history = completedIds.length
    ? await db.select({
        sessionId: attendance.sessionId,
        studentId: attendance.studentId,
        status: attendance.status,
        checkInAt: attendance.checkInAt,
        checkOutAt: attendance.checkOutAt,
      }).from(attendance).where(inArray(attendance.sessionId, completedIds))
    : [];
  return NextResponse.json({
    session,
    roster: roster.map((student) => ({
      ...student,
      name: student.name ?? ([student.firstName, student.lastName].filter(Boolean).join(" ") || "Student"),
      avatarUrl: student.avatarUrl ? `/api/portal/profile-photo?userId=${student.studentId}&classId=${session.classId}` : null,
      attendancePercent: calculateAttendancePercent(completedSessions, history, student.studentId),
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { sessionId } = await params;
  const [session] = await db.select().from(timetableSessions).where(eq(timetableSessions.id, sessionId)).limit(1);
  if (!session) return NextResponse.json({ error: "Class session not found" }, { status: 404 });
  const { action, studentId } = parsed.data;
  const now = new Date();
  const manager = await canManageSession(user.id, user.role, session);

  if (action === "start") {
    if (!manager) return NextResponse.json({ error: "Only the assigned teacher or academic administrator can start class" }, { status: 403 });
    if (session.liveStartedAt) return NextResponse.json({ error: "This class has already started" }, { status: 409 });
    if (now < new Date(session.startsAt.getTime() - 30 * 60_000) || now >= session.endsAt) {
      return NextResponse.json({ error: "Class can only be started from 30 minutes before its scheduled time until its scheduled end" }, { status: 409 });
    }
    await db.update(timetableSessions).set({ liveStartedAt: now, teacherCheckInAt: now }).where(eq(timetableSessions.id, session.id));
    return NextResponse.json({ ok: true, liveStartedAt: now });
  }

  if (action === "end") {
    if (!manager) return NextResponse.json({ error: "Only the assigned teacher or academic administrator can end class" }, { status: 403 });
    if (!session.liveStartedAt || session.liveEndedAt) return NextResponse.json({ error: "This class is not currently live" }, { status: 409 });
    const lastAttendanceMinute = new Date(Math.min(now.getTime(), session.endsAt.getTime()));
    await db.transaction(async (tx) => {
      await tx.update(timetableSessions).set({ liveEndedAt: now, teacherCheckOutAt: now }).where(eq(timetableSessions.id, session.id));
      await tx.update(attendance)
        .set({ checkOutAt: lastAttendanceMinute })
        .where(and(eq(attendance.sessionId, session.id), isNotNull(attendance.checkInAt), isNull(attendance.checkOutAt), inArray(attendance.status, ["pending", "present"])));
    });
    return NextResponse.json({ ok: true, liveEndedAt: now });
  }

  if (action === "confirm" || action === "mark_absent") {
    if (!manager) return NextResponse.json({ error: "Only the assigned teacher or academic administrator can review attendance" }, { status: 403 });
    if (!studentId || !session.classId) return NextResponse.json({ error: "A student and class are required" }, { status: 400 });
    const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(eq(enrolments.studentId, studentId), eq(enrolments.classId, session.classId), eq(enrolments.status, "active"))).limit(1);
    if (!enrollment) return NextResponse.json({ error: "Student is not enrolled in this class" }, { status: 404 });
    if (action === "confirm") {
      const [record] = await db.select().from(attendance).where(and(eq(attendance.sessionId, session.id), eq(attendance.studentId, studentId))).limit(1);
      if (!record?.checkInAt) return NextResponse.json({ error: "Student has not checked in" }, { status: 409 });
      await db.update(attendance).set({ status: "present", confirmedBy: user.id, confirmedAt: now }).where(eq(attendance.id, record.id));
    } else {
      if (!session.liveEndedAt) return NextResponse.json({ error: "Absences can only be finalized after class ends" }, { status: 409 });
      const [record] = await db.select({ id: attendance.id }).from(attendance).where(and(eq(attendance.sessionId, session.id), eq(attendance.studentId, studentId))).limit(1);
      if (record) {
        await db.update(attendance).set({ status: "absent", checkOutAt: null, confirmedBy: user.id, confirmedAt: now }).where(eq(attendance.id, record.id));
      } else {
        await db.insert(attendance).values({ sessionId: session.id, studentId, status: "absent", confirmedBy: user.id, confirmedAt: now });
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "correct") {
    if (!manager) return NextResponse.json({ error: "Only the assigned teacher or academic administrator can correct attendance" }, { status: 403 });
    if (!studentId || !session.classId || !parsed.data.status || !parsed.data.reason) {
      return NextResponse.json({ error: "Student, corrected status, and a reason are required" }, { status: 400 });
    }
    if (!session.liveEndedAt) return NextResponse.json({ error: "Attendance corrections are available after class ends" }, { status: 409 });
    const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(eq(enrolments.studentId, studentId), eq(enrolments.classId, session.classId))).limit(1);
    if (!enrollment) return NextResponse.json({ error: "Student is not enrolled in this class" }, { status: 404 });
    const checkInAt = parsed.data.checkInAt ?? null;
    const checkOutAt = parsed.data.checkOutAt ?? null;
    if (parsed.data.status === "present") {
      if (!checkInAt || !checkOutAt || checkOutAt <= checkInAt) {
        return NextResponse.json({ error: "A present record needs a valid check-in and check-out time" }, { status: 400 });
      }
      if (checkInAt < session.startsAt || checkOutAt > session.endsAt) {
        return NextResponse.json({ error: "Corrected times must be inside the scheduled class window" }, { status: 400 });
      }
    }
    const [existing] = await db.select().from(attendance).where(and(eq(attendance.sessionId, session.id), eq(attendance.studentId, studentId))).limit(1);
    const values = {
      status: parsed.data.status,
      checkInAt: parsed.data.status === "present" ? checkInAt : null,
      checkOutAt: parsed.data.status === "present" ? checkOutAt : null,
      confirmedBy: user.id,
      confirmedAt: now,
      markedAt: now,
      note: parsed.data.reason,
    };
    const [updated] = existing
      ? await db.update(attendance).set(values).where(eq(attendance.id, existing.id)).returning({ id: attendance.id })
      : await db.insert(attendance).values({ sessionId: session.id, studentId, ...values }).returning({ id: attendance.id });
    await db.insert(auditLogs).values({
      actorId: user.id,
      action: "correct_attendance",
      entityType: "attendance",
      entityId: updated.id,
      before: existing ? { status: existing.status, checkInAt: existing.checkInAt, checkOutAt: existing.checkOutAt } : null,
      after: { ...values, sessionId: session.id, studentId },
    });
    return NextResponse.json({ ok: true });
  }

  if (user.role !== "student") return NextResponse.json({ error: "Student check-in is required" }, { status: 403 });
  if (!session.classId) return NextResponse.json({ error: "This session has no enrolled class" }, { status: 403 });
  const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(eq(enrolments.studentId, user.id), eq(enrolments.classId, session.classId), eq(enrolments.status, "active"))).limit(1);
  if (!enrollment) return NextResponse.json({ error: "You are not enrolled in this class" }, { status: 403 });
  if (!session.liveStartedAt || session.liveEndedAt) return NextResponse.json({ error: "Student check-in is available only while class is live" }, { status: 409 });
  if (action === "check_in") {
    if (now >= session.endsAt) return NextResponse.json({ error: "The scheduled class time has ended" }, { status: 409 });
    const [existing] = await db.select().from(attendance).where(and(eq(attendance.sessionId, session.id), eq(attendance.studentId, user.id))).limit(1);
    if (existing?.checkInAt) return NextResponse.json({ error: "You have already checked in" }, { status: 409 });
    if (existing) {
      await db.update(attendance).set({ checkInAt: now, checkOutAt: null, status: "pending", confirmedAt: null, confirmedBy: null }).where(eq(attendance.id, existing.id));
    } else {
      await db.insert(attendance).values({ sessionId: session.id, studentId: user.id, checkInAt: now, status: "pending" });
    }
  } else if (action === "check_out") {
    const [existing] = await db.select().from(attendance).where(and(eq(attendance.sessionId, session.id), eq(attendance.studentId, user.id))).limit(1);
    if (!existing?.checkInAt) return NextResponse.json({ error: "Check in before checking out" }, { status: 409 });
    if (existing.checkOutAt) return NextResponse.json({ error: "You have already checked out" }, { status: 409 });
    await db.update(attendance).set({ checkOutAt: new Date(Math.min(now.getTime(), session.endsAt.getTime())) }).where(eq(attendance.id, existing.id));
  } else {
    return NextResponse.json({ error: "Invalid student attendance action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
