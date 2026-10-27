import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, smsCampaigns, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { detectPhoneOrHandle } from "@/lib/phone-filter";

const schema = z.object({ message: z.string().trim().min(1).max(480) });
type ProviderResult = {
  SMSMessageData?: {
    Recipients?: { statusCode?: number }[];
  };
};

function toE164(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^2567\d{8}$/.test(digits)) return `+${digits}`;
  if (/^07\d{8}$/.test(digits)) return `+256${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `+256${digits}`;
  return null;
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "School administrator access required" }, { status: 403 });
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const senderId = process.env.AFRICASTALKING_SENDER_ID;
  if (!username || !apiKey) {
    return NextResponse.json({ error: "Africa's Talking is not configured. Set AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY on the server." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (detectPhoneOrHandle(parsed.data.message).blocked) {
    return NextResponse.json({ error: "Messages may not contain phone numbers or external-contact handles." }, { status: 400 });
  }

  const recipients = await db.select({ phone: users.phone }).from(users).where(and(
    eq(users.role, "student"),
    inArray(users.status, ["registered", "active"]),
    isNotNull(users.phone),
    isNull(users.deletedAt),
  ));
  const phoneNumbers = recipients
    .map((recipient: { phone: string | null }) => recipient.phone ? toE164(recipient.phone) : null)
    .filter((number: string | null): number is string => Boolean(number));
  const skippedCount = recipients.length - phoneNumbers.length;
  if (!phoneNumbers.length) return NextResponse.json({ error: "No eligible student mobile numbers are on file." }, { status: 409 });

  const [campaign] = await db.insert(smsCampaigns).values({
    createdBy: actor.id,
    message: parsed.data.message,
    recipientCount: 0,
    status: "sending",
  }).returning({ id: smsCampaigns.id });
  let accepted = 0;
  let failed = false;
  for (let index = 0; index < phoneNumbers.length; index += 100) {
    const batch = phoneNumbers.slice(index, index + 100);
    const form = new URLSearchParams({
      username,
      to: batch.join(","),
      message: parsed.data.message,
    });
    if (senderId) form.set("from", senderId);
    try {
      const response = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(20_000),
      });
      const result = await response.json() as ProviderResult;
      const acceptedInBatch = result.SMSMessageData?.Recipients?.filter((recipient) => recipient.statusCode === 100 || recipient.statusCode === 101).length ?? 0;
      accepted += Math.min(batch.length, acceptedInBatch);
      if (!response.ok || !result.SMSMessageData?.Recipients || acceptedInBatch < batch.length) {
        failed = true;
        break;
      }
    } catch {
      failed = true;
      break;
    }
  }

  const status = failed ? (accepted ? "partial" : "failed") : skippedCount ? "partial" : "submitted";
  await db.update(smsCampaigns).set({ recipientCount: accepted, status }).where(eq(smsCampaigns.id, campaign.id));
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "send_bulk_sms",
    entityType: "sms_campaign",
    entityId: campaign.id,
    after: { status, recipientCount: accepted, skippedCount },
  });
  if (failed) {
    return NextResponse.json({
      error: "Africa's Talking did not accept the complete campaign. Check the SMS provider dashboard before retrying.",
      campaignId: campaign.id,
      acceptedCount: accepted,
    }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    campaignId: campaign.id,
    acceptedCount: accepted,
    skippedCount,
    message: skippedCount ? "Message submitted to valid student numbers. Some registered accounts have no valid Uganda mobile number on file." : undefined,
  });
}
