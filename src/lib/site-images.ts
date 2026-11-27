import "server-only";
import { db } from "@/db";
import { siteImages } from "@/db/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { SITE_IMAGE_SLOTS, type SiteImageSlotId } from "@/lib/site-image-slots";

export type ResolvedSiteImage = { url: string; altText: string };
export type ResolvedSiteImages = Partial<Record<SiteImageSlotId, ResolvedSiteImage>>;

export async function getSiteImages(): Promise<ResolvedSiteImages> {
  try {
    const rows = await db.select().from(siteImages);
    const bucket = createSupabaseAdminClient().storage.from("site-media");
    return Object.fromEntries(rows.map((row) => [
      row.slot,
      { url: bucket.getPublicUrl(row.storagePath).data.publicUrl, altText: row.altText },
    ])) as ResolvedSiteImages;
  } catch (error) {
    console.warn("Public site images could not be loaded; local image defaults will be used.", error instanceof Error ? error.name : "Unknown error");
    return {};
  }
}

export async function getSiteImage(slot: SiteImageSlotId): Promise<ResolvedSiteImage | null> {
  const images = await getSiteImages();
  return images[slot] ?? null;
}

export { SITE_IMAGE_SLOTS };
