import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isAllowedSocialUrl, parseSocialLinks, SOCIAL_SLOTS, type SocialSlot } from "@/lib/social-links";

export const runtime = "nodejs";

const linkSchema = z.object({
  slot: z.enum(SOCIAL_SLOTS.map((item) => item.id) as [SocialSlot, ...SocialSlot[]]),
  url: z.string().trim().max(500),
}).strict().superRefine((link, context) => {
  if (!isAllowedSocialUrl(link.slot, link.url)) {
    context.addIssue({ code: "custom", path: ["url"], message: `Enter a secure ${SOCIAL_SLOTS.find((item) => item.id === link.slot)?.name} profile link.` });
  }
});

export async function PUT(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if ((actor.role !== "super_admin" && actor.role !== "admin")) return NextResponse.json({ error: "Only the administrator can update public social links" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = z.object({ links: z.array(linkSchema).length(SOCIAL_SLOTS.length) }).strict().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const links = parseSocialLinks(parsed.data.links);
  if (!links) return NextResponse.json({ error: "Include each social network once and use a matching HTTPS profile link." }, { status: 400 });

  await db.insert(settings).values({ key: "public_social_links", value: links })
    .onConflictDoUpdate({ target: settings.key, set: { value: links, updatedAt: new Date() } });
  revalidatePath("/");
  revalidatePath("/api/public/social-links");
  return NextResponse.json({ ok: true, links });
}
