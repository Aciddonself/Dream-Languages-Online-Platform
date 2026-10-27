import { and, asc, eq, inArray, lt, lte, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { enrolments, feeSchedules, payments, timetableSessions, users } from "@/db/schema";
import { createTextPdf } from "@/lib/pdf";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: "Email delivery is not configured" }, { status: 503 });
  }

  const now = new Date();
  let sentCount = 0;
  let failedCount = 0;

  for (const minutes of [25, 10]) {
    const target = new Date(now.getTime() + minutes * 60_000);
    const windowStart = new Date(target.getTime() - 60_000);
    const sessions = await db.select({
      id: timetableSessions.id,
      title: timetableSessions.title,
      startsAt: timetableSessions.startsAt,
      endsAt: timetableSessions.endsAt,
      classId: timetableSessions.classId,
      teacherId: timetableSessions.teacherId,
      room: timetableSessions.room,
    }).from(timetableSessions).where(and(gte(timetableSessions.startsAt, windowStart), lte(timetableSessions.startsAt, target)));
    for (const session of sessions) {
      const recipients = session.classId
        ? await db.select({ id: users.id, email: users.email, name: users.displayName }).from(enrolments)
            .innerJoin(users, eq(users.id, enrolments.studentId))
            .where(and(eq(enrolments.status, "active"), eq(enrolments.classId, session.classId), eq(users.role, "student")))
        : [] as Array<{ id: string; email: string; name: string | null }>;
      const teacher = session.teacherId
        ? (await db.select({ id: users.id, email: users.email, name: users.displayName }).from(users).where(eq(users.id, session.teacherId)).limit(1))[0]
        : undefined;
      const sessionRecipients = [...recipients, ...(teacher ? [teacher] : [])];
      for (const recipient of sessionRecipients) {
        const result = await sendEmail({
          to: recipient.email,
          subject: `Class reminder: ${session.title} begins in ${minutes} minutes`,
          html: `<p>Hello ${recipient.name ?? "there"},</p><p>This is a reminder that <strong>${session.title}</strong> begins in ${minutes} minutes at ${session.startsAt.toLocaleString()}.</p><p>${session.room ? `Location: ${session.room}. ` : ""}Sign in to your Dream Languages Uganda portal and open your timetable to join the class.</p>`,
          dedupeKey: `class-reminder:${session.id}:${recipient.id}:${minutes}`,
        });
        if (result.sent) sentCount++;
        else failedCount++;
      }
    }
  }

  if (now.getUTCDate() === 1) {
    const month = now.toISOString().slice(0, 7);
    const eligibleStudents = await db.select({
      id: users.id,
      email: users.email,
      name: users.displayName,
      registrationNumber: users.registrationNumber,
      createdAt: users.createdAt,
    }).from(users).where(and(
      eq(users.role, "student"),
      inArray(users.status, ["registered", "active"]),
      lt(users.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60_000)),
    ));
    for (const student of eligibleStudents) {
      const [schedule, verifiedPayments]: [
        Array<{ amount: number; paid: number; currency: string | null; dueDate: Date | null }>,
        Array<{ amount: number; currency: string | null; reference: string | null; createdAt: Date }>,
      ] = await Promise.all([
        db.select({ amount: feeSchedules.amount, paid: feeSchedules.paid, currency: feeSchedules.currency, dueDate: feeSchedules.dueDate }).from(feeSchedules).where(eq(feeSchedules.studentId, student.id)).orderBy(asc(feeSchedules.dueDate)),
        db.select({ amount: payments.amount, currency: payments.currency, reference: payments.reference, createdAt: payments.createdAt }).from(payments).where(and(eq(payments.studentId, student.id), eq(payments.status, "verified"))).orderBy(asc(payments.createdAt)),
      ]);
      const currencies = [...new Set([...schedule.map((item: { currency: string | null }) => item.currency), ...verifiedPayments.map((payment: { currency: string | null }) => payment.currency)])].filter((currency): currency is string => Boolean(currency));
      const balances = currencies.map((currency) => {
        const currencySchedule = schedule.filter((item: { currency: string | null }) => item.currency === currency);
        const currencyPayments = verifiedPayments.filter((payment: { currency: string | null }) => payment.currency === currency);
        return {
          currency,
          due: currencySchedule.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0),
          paid: currencySchedule.reduce((sum: number, item: { paid: number }) => sum + item.paid, 0),
          balance: currencySchedule.reduce((sum: number, item: { amount: number; paid: number }) => sum + Math.max(0, item.amount - item.paid), 0),
          verifiedPayments: currencyPayments.reduce((sum: number, payment: { amount: number }) => sum + payment.amount, 0),
        };
      });
      const lines = [
        "Dream Languages Uganda",
        `Student: ${student.name ?? "Student"}`,
        `Registration number: ${student.registrationNumber ?? "Not assigned"}`,
        `Statement period: ${month}`,
        "",
        "Fee schedule:",
        ...(schedule.length ? schedule.map((item) => `Due ${item.dueDate ?? "date pending"} | ${item.currency} ${item.amount.toLocaleString()} | Paid credit ${item.currency} ${item.paid.toLocaleString()} | Remaining ${item.currency} ${Math.max(0, item.amount - item.paid).toLocaleString()}`) : ["No fee schedule is recorded. Contact the finance office to confirm your fees."]),
        "",
        ...balances.map((item: { currency: string | null; due: number; paid: number; verifiedPayments: number; balance: number }) => `${item.currency ?? "USD"} fees: ${item.due.toLocaleString()} | scheduled credits: ${item.paid.toLocaleString()} | verified payments: ${item.verifiedPayments.toLocaleString()} | balance: ${item.balance.toLocaleString()}`),
        "Verified payment history:",
        ...verifiedPayments.map((payment: { createdAt: Date; currency: string | null; amount: number; reference: string | null }) => `${payment.createdAt.toISOString().slice(0, 10)} | ${payment.currency ?? "USD"} ${payment.amount.toLocaleString()}${payment.reference ? ` | Ref ${payment.reference}` : ""}`),
        "",
        "For questions about your account, contact the school finance office.",
      ];
      const statement = createTextPdf("Dream Languages Uganda Monthly Fee Statement", lines);
      const result = await sendEmail({
        to: student.email,
        subject: `Your Dream Languages Uganda fee statement for ${month}`,
        html: `<p>Hello ${student.name ?? "Student"},</p><p>Your monthly fee statement is attached. It lists your verified payments and current scheduled fee balance.</p><p>Dream Languages Uganda</p>`,
        dedupeKey: `monthly-fee-statement:${student.id}:${month}`,
        attachments: [{ filename: `dla-fee-statement-${month}.pdf`, content: statement, contentType: "application/pdf" }],
      });
      if (result.sent) sentCount++;
      else failedCount++;
    }
  }
  return NextResponse.json({ ok: failedCount === 0, sentCount, failedCount });
}
