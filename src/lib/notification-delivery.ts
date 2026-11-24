import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { classes, enrolments, notifications, users } from "@/db/schema";

type Audience = "all" | "language" | "class";

/** Fan out a school notice to eligible, individual portal inboxes. */
export async function notifySchoolAudience(input: {
  title: string;
  body?: string | null;
  audience: Audience;
  departmentId?: string | null;
  classId?: string | null;
  excludeUserId?: string;
}) {
  let recipientIds: string[] = [];

  if (input.audience === "all") {
    const recipients = await db.select({ id: users.id }).from(users).where(and(
      inArray(users.status, ["active", "registered"]), isNull(users.deletedAt), ne(users.role, "applicant"),
    ));
    recipientIds = recipients.map((row) => row.id);
  } else if (input.audience === "language" && input.departmentId) {
    const [departmentUsers, departmentClasses] = await Promise.all([
      db.select({ id: users.id }).from(users).where(and(
        eq(users.departmentId, input.departmentId), inArray(users.status, ["active", "registered"]),
        isNull(users.deletedAt), ne(users.role, "applicant"),
      )),
      db.select({ id: classes.id, teacherId: classes.teacherId }).from(classes).where(and(
        eq(classes.departmentId, input.departmentId), isNull(classes.deletedAt),
      )),
    ]);
    const classIds = departmentClasses.map((row) => row.id);
    const enrolled = classIds.length
      ? await db.select({ id: enrolments.studentId }).from(enrolments).where(and(
        inArray(enrolments.classId, classIds), eq(enrolments.status, "active"),
      ))
      : [];
    recipientIds = [
      ...departmentUsers.map((row) => row.id),
      ...enrolled.map((row) => row.id),
      ...departmentClasses.flatMap((row) => row.teacherId ? [row.teacherId] : []),
    ];
  } else if (input.audience === "class" && input.classId) {
    const [enrolled, [schoolClass]] = await Promise.all([
      db.select({ id: enrolments.studentId }).from(enrolments).where(and(
        eq(enrolments.classId, input.classId), eq(enrolments.status, "active"),
      )),
      db.select({ teacherId: classes.teacherId }).from(classes).where(and(
        eq(classes.id, input.classId), isNull(classes.deletedAt),
      )).limit(1),
    ]);
    recipientIds = [...enrolled.map((row) => row.id), ...(schoolClass?.teacherId ? [schoolClass.teacherId] : [])];
  }

  const candidateIds = [...new Set(recipientIds)].filter((id) => id !== input.excludeUserId);
  const eligibleUsers = candidateIds.length
    ? await db.select({ id: users.id }).from(users).where(and(
      inArray(users.id, candidateIds), inArray(users.status, ["active", "registered"]),
      isNull(users.deletedAt), ne(users.role, "applicant"),
    ))
    : [];
  const uniqueIds = eligibleUsers.map((row) => row.id);
  if (!uniqueIds.length) return 0;

  for (let offset = 0; offset < uniqueIds.length; offset += 500) {
    await db.insert(notifications).values(uniqueIds.slice(offset, offset + 500).map((userId) => ({
      userId,
      title: input.title,
      body: input.body ?? null,
    })));
  }
  return uniqueIds.length;
}

export async function notifyOne(userId: string, title: string, body?: string | null) {
  await db.insert(notifications).values({ userId, title, body: body ?? null });
}
