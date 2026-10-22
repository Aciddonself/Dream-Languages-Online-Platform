import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { classes, discussionRooms, enrolments, roomMembers, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const createSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  topic: z.string().trim().max(500).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const records = user.role === "super_admin"
    ? await db.select({
        id: discussionRooms.id,
        title: discussionRooms.title,
        topic: discussionRooms.topic,
        classId: discussionRooms.classId,
        className: classes.name,
        createdAt: discussionRooms.createdAt,
      }).from(discussionRooms).leftJoin(classes, eq(discussionRooms.classId, classes.id))
        .where(eq(discussionRooms.status, "open"))
    : await db.select({
        id: discussionRooms.id,
        title: discussionRooms.title,
        topic: discussionRooms.topic,
        classId: discussionRooms.classId,
        className: classes.name,
        createdAt: discussionRooms.createdAt,
      }).from(roomMembers)
        .innerJoin(discussionRooms, eq(roomMembers.roomId, discussionRooms.id))
        .leftJoin(classes, eq(discussionRooms.classId, classes.id))
        .where(and(eq(roomMembers.userId, user.id), eq(discussionRooms.status, "open")));
  return NextResponse.json({ rooms: records }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["teacher", "head_academics", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Teacher or Head of Academics access required" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [schoolClass] = await db.select().from(classes).where(eq(classes.id, parsed.data.classId)).limit(1);
  if (!schoolClass || schoolClass.deletedAt) return NextResponse.json({ error: "Active class not found" }, { status: 404 });
  if (user.role === "teacher" && schoolClass.teacherId !== user.id) {
    return NextResponse.json({ error: "You can only organize discussions for your assigned classes" }, { status: 403 });
  }
  const [room] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(discussionRooms).values({
      title: parsed.data.title,
      topic: parsed.data.topic || null,
      visibility: "class",
      classId: schoolClass.id,
      departmentId: schoolClass.departmentId,
      ownerId: user.id,
      status: "open",
    }).returning({ id: discussionRooms.id });
    const roster = await tx.select({ id: enrolments.studentId }).from(enrolments)
      .where(and(eq(enrolments.classId, schoolClass.id), eq(enrolments.status, "active")));
    const academicLeads = await tx.select({ id: users.id }).from(users).where(eq(users.role, "head_academics"));
    const memberIds = new Set([
      user.id,
      schoolClass.teacherId,
      ...roster.map((member) => member.id),
      ...academicLeads.map((lead) => lead.id),
    ].filter((id): id is string => Boolean(id)));
    await tx.insert(roomMembers).values([...memberIds].map((userId) => ({ roomId: created.id, userId }))).onConflictDoNothing();
    return [created];
  });
  return NextResponse.json({ ok: true, room }, { status: 201 });
}
