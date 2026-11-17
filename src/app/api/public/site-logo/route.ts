import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteImages } from "@/db/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [logo] = await db.select().from(siteImages).where(eq(siteImages.slot, "site_logo")).limit(1);
    if (!logo) return NextResponse.json({ src: "/dla-logo.png", alt: "DLA Logo" }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
    const url = createSupabaseAdminClient().storage.from("site-media").getPublicUrl(logo.storagePath).data.publicUrl;
    return NextResponse.json({ src: url, alt: logo.altText }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ src: "/dla-logo.png", alt: "DLA Logo" }, { headers: { "Cache-Control": "no-store" } });
  }
}
