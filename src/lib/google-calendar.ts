import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

const SETTING_KEY = "google_calendar_oauth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

type EncryptedSecret = { v: 1; iv: string; tag: string; ciphertext: string };
type GoogleCalendarSecret = { refreshToken: string; email: string | null; connectedAt: string };
type GoogleEventResponse = {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
};

function getKey() {
  const keyText = process.env.MEET_LINK_ENCRYPTION_KEY ?? "";
  const key = Buffer.from(keyText, "base64");
  if (key.length !== 32) throw new Error("MEET_LINK_ENCRYPTION_KEY must be a base64 encoded 32-byte key.");
  return key;
}

function encryptSecret(value: GoogleCalendarSecret): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") };
}

function decryptSecret(value: unknown): GoogleCalendarSecret | null {
  if (!value || typeof value !== "object") return null;
  const sealed = value as Partial<EncryptedSecret>;
  if (sealed.v !== 1 || !sealed.iv || !sealed.tag || !sealed.ciphertext) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(sealed.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(sealed.tag, "base64url"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64url")), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(plaintext) as Partial<GoogleCalendarSecret>;
    if (typeof parsed.refreshToken !== "string" || !parsed.refreshToken) return null;
    return { refreshToken: parsed.refreshToken, email: typeof parsed.email === "string" ? parsed.email : null, connectedAt: typeof parsed.connectedAt === "string" ? parsed.connectedAt : "" };
  } catch {
    return null;
  }
}

export function googleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrl = process.env.APP_URL?.trim();
  if (!clientId || !clientSecret || !appUrl) return null;
  const callbackUrl = process.env.GOOGLE_REDIRECT_URI?.trim()
    || `${process.env.NODE_ENV === "production" && process.env.ADMIN_HOST ? `https://${process.env.ADMIN_HOST}` : appUrl.replace(/\/$/, "")}/api/admin/google-calendar/callback`;
  return { clientId, clientSecret, callbackUrl };
}

export function googleAdminOrigin() {
  if (process.env.NODE_ENV === "production" && process.env.ADMIN_HOST?.trim()) return `https://${process.env.ADMIN_HOST.trim()}`;
  return process.env.APP_URL?.trim() || "http://localhost:3000";
}

export function googleCalendarIsConfigured() {
  return Boolean(googleOAuthConfig()) && Buffer.from(process.env.MEET_LINK_ENCRYPTION_KEY ?? "", "base64").length === 32;
}

export async function googleCalendarConnectionStatus() {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, SETTING_KEY)).limit(1);
  const secret = row ? decryptSecret(row.value) : null;
  return { connected: Boolean(secret), email: secret?.email ?? null };
}

export async function storeGoogleCalendarSecret(value: GoogleCalendarSecret) {
  const encrypted = encryptSecret(value);
  await db.insert(settings).values({ key: SETTING_KEY, value: encrypted })
    .onConflictDoUpdate({ target: settings.key, set: { value: encrypted, updatedAt: new Date() } });
}

export async function removeGoogleCalendarSecret() {
  await db.delete(settings).where(eq(settings.key, SETTING_KEY));
}

async function getAccessToken() {
  const config = googleOAuthConfig();
  if (!config) throw new Error("Google Calendar OAuth is not configured on the server.");
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, SETTING_KEY)).limit(1);
  const secret = row ? decryptSecret(row.value) : null;
  if (!secret) throw new Error("Connect the school Google Calendar before creating an automatic Meet link.");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: secret.refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  const payload = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    console.error("Google access token refresh failed:", payload.error ?? response.status);
    throw new Error("Google Calendar authorization expired. Reconnect the school account from Admin → Academic.");
  }
  return payload.access_token;
}

function meetUrlFrom(event: GoogleEventResponse) {
  const candidate = event.hangoutLink ?? event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.hostname === "meet.google.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function createGoogleCalendarMeet(input: {
  title: string;
  startsAt: Date;
  endsAt: Date;
  recurrenceUntil?: Date;
  recurrenceCount?: number;
  description?: string;
}) {
  const accessToken = await getAccessToken();
  const requestId = randomBytes(18).toString("base64url");
  const recurrence = input.recurrenceCount
    ? [`RRULE:FREQ=WEEKLY;COUNT=${input.recurrenceCount}`]
    : input.recurrenceUntil
    ? [`RRULE:FREQ=WEEKLY;UNTIL=${input.recurrenceUntil.toISOString().slice(0, 10).replaceAll("-", "")}T235959Z`]
    : undefined;
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: input.title,
      description: input.description ?? "Dream Languages Uganda online class.",
      start: { dateTime: input.startsAt.toISOString(), timeZone: "Africa/Kampala" },
      end: { dateTime: input.endsAt.toISOString(), timeZone: "Africa/Kampala" },
      ...(recurrence ? { recurrence } : {}),
      conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    }),
    cache: "no-store",
  });
  const first = await response.json() as GoogleEventResponse & { error?: { message?: string } };
  if (!response.ok || !first.id) {
    console.error("Google Calendar event creation failed:", response.status, first.error?.message ?? "No event ID");
    throw new Error("Google could not create the calendar event. Check the connected account and Calendar API access.");
  }

  let event = first;
  let meetUrl = meetUrlFrom(event);
  for (let attempt = 0; !meetUrl && attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const refresh = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(first.id)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
    });
    if (refresh.ok) {
      event = await refresh.json() as GoogleEventResponse;
      meetUrl = meetUrlFrom(event);
    }
  }

  if (!meetUrl) {
    await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(first.id)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
    }).catch(() => undefined);
    throw new Error("Google created the event but did not return a Meet link in time. Please try scheduling again.");
  }

  return { meetUrl, calendarEventUrl: event.htmlLink ?? first.htmlLink ?? null, calendarEventId: first.id };
}

export async function deleteGoogleCalendarEvent(eventId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (!response.ok && response.status !== 404) throw new Error("Could not clean up the Google Calendar event after scheduling failed.");
}

export async function revokeGoogleCalendarGrant() {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, SETTING_KEY)).limit(1);
  const secret = row ? decryptSecret(row.value) : null;
  if (!secret) return;
  const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(secret.refreshToken)}`, { method: "POST", cache: "no-store" });
  if (!response.ok && response.status !== 400) throw new Error("Google did not confirm revoking Calendar access.");
  await removeGoogleCalendarSecret();
}
