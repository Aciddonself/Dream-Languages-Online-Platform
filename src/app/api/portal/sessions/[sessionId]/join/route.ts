import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { classes, enrolments, timetableSessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { sessionId } = await params;
  const [session] = await db.select({
    id: timetableSessions.id,
    classId: timetableSessions.classId,
    teacherId: timetableSessions.teacherId,
    meetUrl: timetableSessions.meetUrl,
    startsAt: timetableSessions.startsAt,
    endsAt: timetableSessions.endsAt,
  }).from(timetableSessions).where(eq(timetableSessions.id, sessionId)).limit(1);
  if (!session) return NextResponse.json({ error: "Class session not found" }, { status: 404 });
  let meetUrl: URL;
  try {
    meetUrl = new URL(session.meetUrl ?? "");
  } catch {
    return NextResponse.json({ error: "A Google Meet has not been assigned to this class" }, { status: 409 });
  }
  if (meetUrl.hostname !== "meet.google.com") {
    return NextResponse.json({ error: "A Google Meet has not been assigned to this class" }, { status: 409 });
  }

  if (user.role === "student") {
    // If assigned to a specific class, verify enrolment
    if (session.classId) {
      const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments)
        .where(and(eq(enrolments.classId, session.classId), eq(enrolments.studentId, user.id), eq(enrolments.status, "active"))).limit(1);
      if (!enrollment) {
        return NextResponse.json({ error: "You are not enrolled in this class" }, { status: 403 });
      }
    }
    // If session.classId is null, it is an open school/department live session; active student can join.
  } else if (user.role === "teacher") {
    const [schoolClass] = session.classId
      ? await db.select({ teacherId: classes.teacherId }).from(classes).where(eq(classes.id, session.classId)).limit(1)
      : [];
    if (session.teacherId !== user.id && schoolClass?.teacherId !== user.id && session.classId !== null) {
      // Allow assigned teacher, class teacher, or if open session
    }
  } else if (!["head_academics", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Portal access required" }, { status: 403 });
  }
  return NextResponse.redirect(meetUrl, 302);
}
