import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { googleAdminOrigin, googleOAuthConfig, storeGoogleCalendarSecret } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
const STATE_COOKIE = "google_calendar_oauth_state";

function destination(origin: string, result: string) {
  const url = new URL("/admin/academic", origin);
  url.searchParams.set("google-calendar", result);
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/admin/google-calendar/callback", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const config = googleOAuthConfig();
  const origin = config ? new URL(config.callbackUrl).origin : googleAdminOrigin();
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "super_admin") return NextResponse.redirect(new URL("/admin/login", origin));
  if (!config) return destination(origin, "not-configured");

  const url = new URL(request.url);
  const queryState = url.searchParams.get("state") ?? "";
  const cookieState = (await cookies()).get(STATE_COOKIE)?.value ?? "";
  const isValidState = queryState.length === cookieState.length && queryState.length > 0
    && timingSafeEqual(Buffer.from(queryState), Buffer.from(cookieState));
  if (!isValidState) return destination(origin, "state-error");
  if (url.searchParams.has("error")) return destination(origin, "cancelled");
  const code = url.searchParams.get("code");
  if (!code) return destination(origin, "connect-error");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callbackUrl, grant_type: "authorization_code" }),
      cache: "no-store",
    });
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; error?: string };
    if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) {
      console.error("Google OAuth callback did not return a refresh token:", tokenResponse.status, tokens.error ?? "missing refresh token");
      return destination(origin, "connect-error");
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store",
    });
    const profile = profileResponse.ok ? await profileResponse.json() as { email?: string } : null;
    await storeGoogleCalendarSecret({ refreshToken: tokens.refresh_token, email: profile?.email ?? null, connectedAt: new Date().toISOString() });
    return destination(origin, "connected");
  } catch (error) {
    console.error("Google Calendar connection failed:", error instanceof Error ? error.message : "unknown error");
    return destination(origin, "connect-error");
  }
}
