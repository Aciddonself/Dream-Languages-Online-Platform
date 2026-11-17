import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { z } from "zod";
import { DEFAULT_SOCIAL_LINKS, SOCIAL_SLOTS, type SocialLink, type SocialLinks, type SocialSlot } from "@/lib/social-link-types";
export { DEFAULT_SOCIAL_LINKS, SOCIAL_SLOTS } from "@/lib/social-link-types";
export type { SocialLink, SocialLinks, SocialSlot } from "@/lib/social-link-types";

/** Compatibility shape for older TikTok-only CMS components. */
export type TikTokLinks = Array<{ label: string; url: string }>;

const accountSchema = z.object({
  slot: z.enum(SOCIAL_SLOTS.map((item) => item.id) as [SocialSlot, ...SocialSlot[]]),
  url: z.string().trim().max(500),
}).strict();

export function isAllowedSocialUrl(slot: SocialSlot, value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const allowed: Record<SocialSlot, string[]> = {
      facebook: ["facebook.com"],
      instagram: ["instagram.com"],
      tiktok1: ["tiktok.com"],
      tiktok2: ["tiktok.com"],
      linkedin: ["linkedin.com"],
      x: ["x.com", "twitter.com"],
      youtube: ["youtube.com", "youtu.be"],
    };
    return allowed[slot].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function parseSocialLinks(value: unknown): SocialLinks | null {
  const parsed = z.array(accountSchema).length(SOCIAL_SLOTS.length).safeParse(value);
  if (!parsed.success) return null;
  const links = parsed.data;
  if (new Set(links.map((link) => link.slot)).size !== SOCIAL_SLOTS.length) return null;
  return links.every((link) => isAllowedSocialUrl(link.slot, link.url)) ? links : null;
}

export async function getSocialLinks(): Promise<SocialLinks> {
  try {
    const [setting] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "public_social_links")).limit(1);
    const links = parseSocialLinks(setting?.value);
    if (links) return links;

    // Preserve the two accounts saved by older versions of the CMS.
    const [legacy] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "public_tiktok_links")).limit(1);
    if (Array.isArray(legacy?.value)) {
      const defaults = [...DEFAULT_SOCIAL_LINKS];
      const profiles = legacy.value as Array<{ url?: unknown }>;
      for (const [index, slot] of (["tiktok1", "tiktok2"] as const).entries()) {
        const url = profiles[index]?.url;
        if (typeof url === "string" && isAllowedSocialUrl(slot, url)) defaults[index + 2] = { slot, url };
      }
      return defaults;
    }
  } catch (error) {
    console.warn("Public social links DB fetch error; using default TikTok accounts:", error);
  }
  return [...DEFAULT_SOCIAL_LINKS];
}

export async function getTikTokLinks(): Promise<TikTokLinks> {
  const links = await getSocialLinks();
  return links
    .filter((link) => link.slot === "tiktok1" || link.slot === "tiktok2")
    .map((link, index) => ({ label: `TikTok ${index + 1}`, url: link.url }));
}
