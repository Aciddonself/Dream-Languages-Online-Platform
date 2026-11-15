import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const link = z.object({
  label: z.string().trim().min(1).max(60),
  url: z.string().trim().url().refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && parsed.hostname === "www.tiktok.com" && /^\/@[\w.-]+\/?$/.test(parsed.pathname);
    } catch { return false; }
  }, "Use an HTTPS TikTok profile link such as https://www.tiktok.com/@school"),
}).strict();

export async function PUT(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "Only the administrator can update public social links" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = z.object({ links: z.array(link).length(2) }).strict().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  await db.insert(settings).values({ key: "public_tiktok_links", value: parsed.data.links })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed.data.links, updatedAt: new Date() } });
  revalidatePath("/");
  return NextResponse.json({ ok: true, links: parsed.data.links });
}
