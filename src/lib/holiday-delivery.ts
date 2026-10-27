import "server-only";

import { sendEmail } from "@/lib/email";
import { formatHolidayDate } from "@/lib/holiday-dates";

export type HolidayEmail = {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string | null;
  details: string | null;
};

export type HolidayRecipient = {
  id: string;
  email: string;
  name: string | null;
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendHolidayEmails(holiday: HolidayEmail, recipients: HolidayRecipient[]) {
  let sentCount = 0;
  let failedCount = 0;
  const date = holiday.endsOn && holiday.endsOn !== holiday.startsOn
    ? `${formatHolidayDate(holiday.startsOn)} to ${formatHolidayDate(holiday.endsOn)}`
    : formatHolidayDate(holiday.startsOn);
  const details = holiday.details
    ? `<p>${escapeHtml(holiday.details).replaceAll("\n", "<br>")}</p>`
    : "";
  const html = `<p>Hello {{name}},</p><p><strong>${escapeHtml(holiday.title)}</strong> is scheduled for ${escapeHtml(date)}.</p>${details}<p>This notice is also available in your Dream Languages Uganda student portal.</p>`;

  for (let offset = 0; offset < recipients.length; offset += 8) {
    const batch = recipients.slice(offset, offset + 8);
    const results = await Promise.all(batch.map((recipient) => sendEmail({
      to: recipient.email,
      subject: `School holiday: ${holiday.title}`,
      html: html.replace("{{name}}", escapeHtml(recipient.name || "Student")),
      dedupeKey: `school-holiday:${holiday.id}:${recipient.id}`,
    })));
    for (const result of results) {
      if (result.sent) sentCount++;
      else failedCount++;
    }
  }
  return { sentCount, failedCount };
}
