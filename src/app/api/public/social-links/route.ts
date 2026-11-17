import { NextResponse } from "next/server";
import { getSocialLinks } from "@/lib/social-links";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ links: await getSocialLinks() }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
