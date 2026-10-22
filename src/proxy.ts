import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getAuthSecret } from "@/lib/auth-config";

const PROTECTED: Record<string, string[]> = {
  "/admin": ["super_admin"],
  "/hoc": ["head_academics", "super_admin"],
  "/teacher": ["teacher", "head_academics", "super_admin"],
  "/finance": ["finance", "super_admin"],
  "/student": ["student", "super_admin"],
  "/applicant": ["applicant", "student", "super_admin"],
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const match = Object.keys(PROTECTED).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!match) return NextResponse.next();

  const token = req.cookies.get("dla_session")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    void payload;
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/hoc/:path*", "/teacher/:path*", "/finance/:path*", "/student/:path*", "/applicant/:path*"],
};