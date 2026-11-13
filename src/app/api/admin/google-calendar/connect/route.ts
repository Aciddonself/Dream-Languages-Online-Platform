import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { googleAdminOrigin, googleOAuthConfig } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
const STATE_COOKIE = "google_calendar_oauth_state";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") return NextResponse.redirect(new URL("/admin/login", googleAdminOrigin()));
  const config = googleOAuthConfig();
  if (!config) return NextResponse.redirect(new URL("/admin/academic?google-calendar=not-configured", googleAdminOrigin()));

  const state = randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email https://www.googleapis.com/auth/calendar.events");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/google-calendar/callback",
    maxAge: 600,
  });
  return NextResponse.redirect(url);
}
