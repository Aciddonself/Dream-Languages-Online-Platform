import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications, schoolHolidays, users } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { addCalendarDays, formatHolidayDate, getKampalaDate } from "@/lib/holiday-dates";
import { escapeHtml } from "@/lib/holiday-delivery";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: "Email delivery is not configured" }, { status: 503 });
  }

  const today = getKampalaDate();
  const reminderThrough = addCalendarDays(today, 14);
  const pendingHolidays = await db.select().from(schoolHolidays).where(and(
    eq(schoolHolidays.status, "pending"),
    isNull(schoolHolidays.reminderSentAt),
    gte(schoolHolidays.startsOn, today),
    lte(schoolHolidays.startsOn, reminderThrough),
  )).limit(100);
  const staff = await db.select({ id: users.id, email: users.email, name: users.displayName })
    .from(users)
    .where(and(
      inArray(users.role, ["super_admin", "head_academics"]),
      inArray(users.status, ["active", "registered"]),
      isNull(users.deletedAt),
    ));

  let sentCount = 0;
  let failedCount = 0;
  let remindedHolidayCount = 0;
  for (const holiday of pendingHolidays) {
    const reminderBody = `${holiday.title} is scheduled for ${formatHolidayDate(holiday.startsOn)} and still needs approval before it is announced to students.`;
    const results = await Promise.all(staff.map((recipient) => sendEmail({
      to: recipient.email,
      subject: `Approval reminder: upcoming holiday ${holiday.title}`,
      html: `<p>Hello ${escapeHtml(recipient.name ?? "School administrator")},</p><p><strong>${escapeHtml(holiday.title)}</strong> is scheduled for ${formatHolidayDate(holiday.startsOn)} and still needs approval before it is announced to students.</p><p>Please sign in to the administrator or Head of Academics portal and review Holiday approvals.</p>`,
      dedupeKey: `school-holiday-approval-reminder:${holiday.id}:${recipient.id}`,
    })));
    const allSent = results.every((result) => result.sent);
    sentCount += results.filter((result) => result.sent).length;
    failedCount += results.filter((result) => !result.sent).length;
    if (!allSent || staff.length === 0) continue;

    await db.transaction(async (tx) => {
      const [updated] = await tx.update(schoolHolidays).set({
        reminderSentAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(schoolHolidays.id, holiday.id),
        isNull(schoolHolidays.reminderSentAt),
      )).returning({ id: schoolHolidays.id });
      if (updated) {
        await tx.insert(notifications).values(staff.map((recipient) => ({
          userId: recipient.id,
          title: `Holiday approval needed: ${holiday.title}`,
          body: reminderBody,
        })));
      }
    });
    remindedHolidayCount++;
  }

  return NextResponse.json({ ok: failedCount === 0, remindedHolidayCount, sentCount, failedCount });
}
