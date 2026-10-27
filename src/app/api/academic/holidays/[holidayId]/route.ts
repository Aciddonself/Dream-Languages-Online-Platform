import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, notifications, schoolHolidays, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { sendHolidayEmails } from "@/lib/holiday-delivery";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ holidayId: string }> },
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["super_admin", "head_academics"].includes(actor.role)) {
    return NextResponse.json({ error: "Administrator or Head of Academics access required" }, { status: 403 });
  }
  const limited = await rateLimit("school-holiday-action", actor.id, 20, "10 m");
  if (!limited.ok) return tooManyRequests(limited.retryAfter);
  const { holidayId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(holidayId)) {
    return NextResponse.json({ error: "Invalid holiday ID" }, { status: 400 });
  }

  let action: unknown;
  try {
    action = (await request.json()).action;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (action !== "approve" && action !== "retry_emails") {
    return NextResponse.json({ error: "Choose approve or retry_emails" }, { status: 400 });
  }

  let holiday;
  let recipients: Array<{ id: string; email: string; name: string | null }>;
  if (action === "approve") {
    const outcome = await db.transaction(async (tx) => {
      const [approved] = await tx.update(schoolHolidays).set({
        status: "approved",
        approvedBy: actor.id,
        approvedAt: new Date(),
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(schoolHolidays.id, holidayId),
        eq(schoolHolidays.status, "pending"),
      )).returning();
      if (!approved) return null;

      const students = await tx.select({ id: users.id, email: users.email, name: users.displayName })
        .from(users)
        .where(and(
          eq(users.role, "student"),
          inArray(users.status, ["active", "registered"]),
          isNull(users.deletedAt),
        ));
      const notificationTitle = `Holiday announcement: ${approved.title}`;
      const date = approved.endsOn && approved.endsOn !== approved.startsOn
        ? `${approved.startsOn} to ${approved.endsOn}`
        : approved.startsOn;
      const notificationBody = `${approved.category === "public_holiday" ? "Public holiday" : "School holiday"} on ${date}.${approved.details ? ` ${approved.details}` : ""}`;
      for (let offset = 0; offset < students.length; offset += 1000) {
        await tx.insert(notifications).values(students.slice(offset, offset + 1000).map((student) => ({
          userId: student.id,
          title: notificationTitle,
          body: notificationBody,
        })));
      }
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: "approve_holiday_announcement",
        entityType: "school_holiday",
        entityId: approved.id,
        after: { title: approved.title, studentNotificationCount: students.length },
        ip: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      });
      return { holiday: approved, recipients: students };
    });
    if (!outcome) return NextResponse.json({ error: "Holiday was not found or has already been approved" }, { status: 409 });
    holiday = outcome.holiday;
    recipients = outcome.recipients;
  } else {
    const [approved] = await db.select().from(schoolHolidays).where(and(
      eq(schoolHolidays.id, holidayId),
      eq(schoolHolidays.status, "approved"),
    )).limit(1);
    if (!approved) return NextResponse.json({ error: "Only an approved holiday can have its email delivery retried" }, { status: 409 });
    holiday = approved;
    recipients = await db.select({ id: users.id, email: users.email, name: users.displayName })
      .from(users)
      .where(and(
        eq(users.role, "student"),
        inArray(users.status, ["active", "registered"]),
        isNull(users.deletedAt),
      ));
  }

  const delivery = await sendHolidayEmails(holiday, recipients);
  if (delivery.failedCount > 0) {
    return NextResponse.json({
      ok: true,
      published: action === "approve",
      studentNotificationCount: action === "approve" ? recipients.length : undefined,
      ...delivery,
      message: "The holiday is published to student portals, but some emails could not be sent. Retry failed emails after configuring email delivery.",
    }, { status: 200 });
  }
  return NextResponse.json({
    ok: true,
    published: action === "approve",
    studentNotificationCount: action === "approve" ? recipients.length : undefined,
    ...delivery,
  });
}
