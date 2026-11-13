import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { googleCalendarConnectionStatus, googleCalendarIsConfigured, revokeGoogleCalendarGrant } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

async function authorize() {
  const user = await getCurrentUser();
  return user?.role === "super_admin";
}

export async function GET() {
  if (!await authorize()) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const status = await googleCalendarConnectionStatus();
  return NextResponse.json({ ...status, configured: googleCalendarIsConfigured() }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE() {
  if (!await authorize()) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    await revokeGoogleCalendarGrant();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Google Calendar disconnect failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not revoke the Google Calendar authorization. Try again." }, { status: 502 });
  }
}
