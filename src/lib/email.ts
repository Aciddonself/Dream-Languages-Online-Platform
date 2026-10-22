import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { emailLogs } from "@/db/schema";

type EmailAttachment = { filename: string; content: Uint8Array; contentType: string };
type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  dedupeKey: string;
  attachments?: EmailAttachment[];
};

export async function sendEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, error: "Email delivery is not configured (RESEND_API_KEY and RESEND_FROM_EMAIL are required)." };

  const [log] = await db.insert(emailLogs).values({
    dedupeKey: input.dedupeKey,
    toEmail: input.to,
    subject: input.subject,
    status: "sending",
  }).onConflictDoNothing().returning({ id: emailLogs.id });
  if (!log) {
    const [existing] = await db.select({ id: emailLogs.id, status: emailLogs.status }).from(emailLogs).where(eq(emailLogs.dedupeKey, input.dedupeKey)).limit(1);
    if (existing?.status === "sent") return { sent: true, duplicate: true };
    if (!existing) return { sent: false, error: "Email delivery record could not be created." };
    await db.update(emailLogs).set({ status: "sending" }).where(eq(emailLogs.id, existing.id));
  }
  const logId = log?.id ?? (await db.select({ id: emailLogs.id }).from(emailLogs).where(eq(emailLogs.dedupeKey, input.dedupeKey)).limit(1))[0]?.id;
  if (!logId) return { sent: false, error: "Email delivery record could not be located." };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content).toString("base64"),
          content_type: attachment.contentType,
        })),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const error = `Email provider returned HTTP ${response.status}.`;
      await db.update(emailLogs).set({ status: "failed" }).where(eq(emailLogs.id, logId));
      return { sent: false, error };
    }
    await db.update(emailLogs).set({ status: "sent", sentAt: new Date() }).where(and(eq(emailLogs.id, logId), eq(emailLogs.status, "sending")));
    return { sent: true };
  } catch (error) {
    await db.update(emailLogs).set({ status: "failed" }).where(eq(emailLogs.id, logId));
    console.error("Email delivery request failed:", error);
    return { sent: false, error: "Email provider could not be reached." };
  }
}
