export const DEFAULT_TIKTOK_LINKS = [
  { label: "Dream Languages Schools", url: "https://www.tiktok.com/@dreamlanguageschools" },
  { label: "Dream Languages Uganda", url: "https://www.tiktok.com/@dream_languages_ug" },
] as const;

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { z } from "zod";

export type TikTokLinks = { label: string; url: string }[];

const linkSchema = z.object({
  label: z.string().trim().min(1).max(60),
  url: z.string().url().refine((value) => {
    try { const parsed = new URL(value); return parsed.protocol === "https:" && parsed.hostname === "www.tiktok.com" && /^\/@[\w.-]+\/?$/.test(parsed.pathname); }
    catch { return false; }
  }),
}).strict();

export async function getTikTokLinks(): Promise<TikTokLinks> {
  const [setting] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "public_tiktok_links")).limit(1);
  const parsed = z.array(linkSchema).length(2).safeParse(setting?.value);
  return parsed.success ? parsed.data : [...DEFAULT_TIKTOK_LINKS];
}
