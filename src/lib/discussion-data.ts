import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { classes, discussionRooms, roomMembers } from "@/db/schema";

export async function getDiscussionHubData(userId: string, role: string) {
  const canCreate = ["teacher", "head_academics", "super_admin"].includes(role);
  const schoolClasses = canCreate
    ? await db.select({ id: classes.id, name: classes.name }).from(classes)
        .where(role === "teacher" ? and(eq(classes.teacherId, userId), isNull(classes.deletedAt)) : isNull(classes.deletedAt))
        .orderBy(classes.name)
    : [];
  const rooms = role === "super_admin"
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
        .where(and(eq(roomMembers.userId, userId), eq(discussionRooms.status, "open")));
  return {
    classes: schoolClasses,
    rooms: rooms.map((room) => ({ ...room, createdAt: room.createdAt.toISOString() })),
    canCreate,
  };
}
