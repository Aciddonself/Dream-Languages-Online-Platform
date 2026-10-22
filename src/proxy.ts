import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED = ["/admin", "/hoc", "/teacher", "/finance", "/student", "/applicant"];
const ADMIN_IDLE_MS = 30 * 60 * 1000;
const isProd = process.env.NODE_ENV === "production";

function buildCsp(nonce: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabase.replace(/^https:/, "wss:");
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "https://challenges.cloudflare.com", ...(isProd ? [] : ["'unsafe-eval'"])];
  const connect = [
    "'self'", supabase, supabaseWs,
    "https://fcm.googleapis.com", "https://fcmregistrations.googleapis.com", "https://firebaseinstallations.googleapis.com",
    "https://challenges.cloudflare.com", ...(isProd ? [] : ["ws:", "http://localhost:*"]),
  ].filter(Boolean);
  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://www.dreamlanguagesug.com https://dreamlanguagesug.com ${supabase}`.trim(),
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isProd && req.headers.get("x-forwarded-proto") === "http") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  const protectedArea = PROTECTED.find((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!protectedArea) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(items) {
        for (const { name, value } of items) req.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        response.headers.set("Content-Security-Policy", csp);
        for (const { name, value, options } of items) {
          response.cookies.set(name, value, { ...options, httpOnly: true, secure: isProd, sameSite: "lax" });
        }
      },
    },
  });

  const loginRedirect = () => {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  };

  const { data } = await supabase.auth.getUser();
  if (!data.user) return loginRedirect();

  // Administrators are signed out after 30 minutes without activity.
  if (protectedArea === "/admin") {
    const last = Number(req.cookies.get("dla_seen")?.value ?? 0);
    if (last && Date.now() - last > ADMIN_IDLE_MS) {
      await supabase.auth.signOut({ scope: "local" });
      const redirect = loginRedirect();
      redirect.cookies.delete("dla_seen");
      return redirect;
    }
    response.cookies.set("dla_seen", String(Date.now()), { httpOnly: true, secure: isProd, sameSite: "strict", path: "/admin" });
  }
  return response;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)" }],
};
