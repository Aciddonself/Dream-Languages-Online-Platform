import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
  "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov",
};
const schema = z.object({ name: z.string().trim().min(1).max(180), contentType: z.string(), size: z.number().int().positive().max(100 * 1024 * 1024), folder: z.enum(["news", "shop"]) }).strict();

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if ((actor.role !== "super_admin" && actor.role !== "admin")) return NextResponse.json({ error: "Only an administrator can add website media" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const extension = TYPES[input.contentType];
  if (!extension) return NextResponse.json({ error: "Choose a JPG, PNG, WebP, GIF, MP4, WebM or MOV file." }, { status: 415 });
  if (input.folder === "shop" && !input.contentType.startsWith("image/")) return NextResponse.json({ error: "Shop items need a photo. Choose JPG, PNG, WebP or GIF." }, { status: 415 });
  const nameExtension = input.name.toLowerCase().slice(input.name.lastIndexOf("."));
  if (nameExtension !== extension) return NextResponse.json({ error: "The file extension must match its format." }, { status: 415 });

  const path = `${input.folder}/${randomUUID()}${extension}`;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from("site-media").createSignedUploadUrl(path, { upsert: false });
  if (error || !data) return NextResponse.json({ error: "Website media storage is not ready. Apply the site media storage migration and try again." }, { status: 503 });
  const { data: publicData } = supabase.storage.from("site-media").getPublicUrl(path);
  return NextResponse.json({ path: data.path, token: data.token, publicUrl: publicData.publicUrl }, { status: 201 });
}
