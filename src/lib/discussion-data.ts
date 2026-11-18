import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { classes, departments, discussionRooms, roomMembers } from "@/db/schema";

export async function getDiscussionHubData(userId: string, role: string) {
  const canCreate = ["teacher", "head_academics", "super_admin"].includes(role);
  const schoolClasses = canCreate
    ? await db.select({ id: classes.id, name: classes.name, departmentId: classes.departmentId }).from(classes)
        .where(role === "teacher" ? and(eq(classes.teacherId, userId), isNull(classes.deletedAt)) : isNull(classes.deletedAt))
        .orderBy(classes.name)
    : [];
  const assignedLanguageIds: string[] = Array.from(new Set<string>(schoolClasses.map((schoolClass) => schoolClass.departmentId).filter((id): id is string => Boolean(id))));
  const languageConditions = [eq(departments.isLanguage, true), isNull(departments.deletedAt)];
  if (role === "teacher" && assignedLanguageIds.length) languageConditions.push(inArray(departments.id, assignedLanguageIds));
  const languages = canCreate && (role !== "teacher" || assignedLanguageIds.length)
    ? await db.select({ id: departments.id, name: departments.name }).from(departments)
        .where(and(...languageConditions)).orderBy(departments.name)
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
    languages,
    rooms: rooms.map((room) => ({ ...room, createdAt: room.createdAt.toISOString() })),
    canCreate,
  };
}
