import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, discussionRooms, incidents, messages, roomMembers, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { detectPhoneOrHandle } from "@/lib/phone-filter";

type Context = { params: Promise<{ roomId: string }> };
const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  teachingNumbers: z.boolean().default(false),
});

async function canOpenRoom(userId: string, role: string, roomId: string) {
  if (role === "super_admin") return true;
  const [member] = await db.select({ roomId: roomMembers.roomId }).from(roomMembers).where(and(
    eq(roomMembers.roomId, roomId),
    eq(roomMembers.userId, userId),
  )).limit(1);
  return Boolean(member);
}

export async function GET(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await params;
  if (!(await canOpenRoom(user.id, user.role, roomId))) {
    return NextResponse.json({ error: "You are not a member of this discussion" }, { status: 403 });
  }
  const [room] = await db.select({ id: discussionRooms.id, title: discussionRooms.title, status: discussionRooms.status })
    .from(discussionRooms).where(eq(discussionRooms.id, roomId)).limit(1);
  if (!room || room.status !== "open") return NextResponse.json({ error: "Discussion is not available" }, { status: 404 });
  const recent = await db.select({
    id: messages.id,
    senderId: messages.senderId,
    body: messages.body,
    createdAt: messages.createdAt,
    senderName: users.displayName,
    firstName: users.firstName,
    lastName: users.lastName,
  }).from(messages).leftJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.roomId, roomId)).orderBy(desc(messages.createdAt)).limit(100);
  return NextResponse.json({
    room,
    messages: recent.reverse().map((message) => ({
      ...message,
      senderName: message.senderName ?? ([message.firstName, message.lastName].filter(Boolean).join(" ") || "Member"),
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await params;
  if (!(await canOpenRoom(user.id, user.role, roomId))) {
    return NextResponse.json({ error: "You are not a member of this discussion" }, { status: 403 });
  }
  const [room] = await db.select({ id: discussionRooms.id, status: discussionRooms.status })
    .from(discussionRooms).where(eq(discussionRooms.id, roomId)).limit(1);
  if (!room || room.status !== "open") return NextResponse.json({ error: "Discussion is not available" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const detection = detectPhoneOrHandle(parsed.data.body);
  const staffTeaching = parsed.data.teachingNumbers && ["teacher", "head_academics"].includes(user.role);
  if (detection.blocked && !(detection.reason === "phone" && staffTeaching)) {
    await db.insert(incidents).values({
      type: detection.reason === "handle" ? "external_contact" : "phone_share",
      actorId: user.id,
      location: `discussion:${roomId}`,
      maskedContent: detection.masked ?? "[blocked]",
    });
    return NextResponse.json({ error: "Phone numbers and external contact details are blocked in class discussions." }, { status: 400 });
  }
  const [message] = await db.insert(messages).values({
    senderId: user.id,
    roomId,
    body: parsed.data.body,
  }).returning({ id: messages.id, createdAt: messages.createdAt });
  if (staffTeaching && detection.blocked) {
    await db.insert(auditLogs).values({
      actorId: user.id,
      action: "post_teaching_numbers",
      entityType: "discussion_message",
      entityId: message.id,
      after: { roomId },
    });
  }
  return NextResponse.json({ ok: true, message }, { status: 201 });
}
