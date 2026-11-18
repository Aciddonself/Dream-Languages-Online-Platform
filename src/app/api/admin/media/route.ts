import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, siteImages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { SITE_IMAGE_SLOTS, type SiteImageSlotId } from "@/lib/site-image-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "site-media";
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const slotSchema = z.string().refine((value): value is SiteImageSlotId => SITE_IMAGE_SLOTS.some((slot) => slot.id === value));
const assignSchema = z.object({ path: z.string().regex(/^media\/[a-f0-9-]{36}\.webp$/i), slot: slotSchema, altText: z.string().trim().min(1).max(180) }).strict();

function errorResponse(error: unknown, message: string) {
  console.error(message, error instanceof Error ? error.name : "Unknown error");
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if ((actor.role !== "super_admin" && actor.role !== "admin")) return NextResponse.json({ error: "School administrator access required" }, { status: 403 });
    const storage = createSupabaseAdminClient().storage.from(BUCKET);
    const [{ data: files, error: listError }, currentRows] = await Promise.all([
      storage.list("media", { limit: 100, sortBy: { column: "created_at", order: "desc" } }),
      db.select().from(siteImages),
    ]);
    const current = currentRows as Array<{ slot: SiteImageSlotId; storagePath: string; altText: string; updatedAt: Date }>;
    if (listError) return NextResponse.json({ error: "Could not open the media library. Confirm the site-media bucket migration has been applied." }, { status: 503 });
    const assets = (files ?? []).filter((file) => file.id).map((file) => {
      const path = `media/${file.name}`;
      return { path, name: file.name, url: storage.getPublicUrl(path).data.publicUrl, createdAt: file.created_at ?? null };
    });
    const slots = SITE_IMAGE_SLOTS.map((slot) => {
      const saved = current.find((item) => item.slot === slot.id);
      return {
        ...slot,
        url: saved ? storage.getPublicUrl(saved.storagePath).data.publicUrl : null,
        altText: saved?.altText ?? slot.alt,
        updatedAt: saved?.updatedAt.toISOString() ?? null,
      };
    });
    return NextResponse.json({ assets, slots });
  } catch (error) {
    return errorResponse(error, "Could not load the website media library.");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if ((actor.role !== "super_admin" && actor.role !== "admin")) return NextResponse.json({ error: "School administrator access required" }, { status: 403 });
    const limited = await rateLimit("admin-media", actor.id, 20, "10 m");
    if (!limited.ok) return tooManyRequests(limited.retryAfter);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Choose an image smaller than 12 MB." }, { status: 400 });
    }
    const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!acceptedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Use a JPG, PNG, WebP, or AVIF image." }, { status: 415 });
    }
    const raw = Buffer.from(await file.arrayBuffer());
    const image = sharp(raw, { limitInputPixels: 32_000_000 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !["jpeg", "png", "webp", "avif"].includes(metadata.format ?? "")) {
      return NextResponse.json({ error: "This file is not a supported image." }, { status: 415 });
    }
    const webp = await sharp(raw, { limitInputPixels: 32_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86, effort: 4 })
      .toBuffer();
    if (webp.byteLength > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "The optimized image is still too large. Choose a smaller image." }, { status: 413 });

    const rawSlot = form.get("slot");
    const slot = rawSlot === "none" || rawSlot === null ? null : slotSchema.safeParse(rawSlot);
    if (slot && slot !== null && !slot.success) return NextResponse.json({ error: "Choose a valid website image location." }, { status: 400 });
    const selectedSlot = slot && slot !== null ? slot.data : null;
    const altText = String(form.get("altText") ?? "").trim();
    if (selectedSlot && (!altText || altText.length > 180)) {
      return NextResponse.json({ error: "Add a short description for accessibility before replacing this image." }, { status: 400 });
    }

    const storagePath = `media/${randomUUID()}.webp`;
    const storage = createSupabaseAdminClient().storage.from(BUCKET);
    const { error: uploadError } = await storage.upload(storagePath, webp, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) return NextResponse.json({ error: "Image upload failed. Confirm the site-media bucket is available in Supabase." }, { status: 502 });

    try {
      if (selectedSlot) {
        await db.insert(siteImages).values({ slot: selectedSlot, storagePath, altText, updatedBy: actor.id, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: siteImages.slot,
            set: { storagePath, altText, updatedBy: actor.id, updatedAt: new Date() },
          });
      }
      await db.insert(auditLogs).values({
        actorId: actor.id,
        action: selectedSlot ? "replace_site_image" : "upload_site_media",
        entityType: "site_media",
        after: { slot: selectedSlot, storagePath },
      });
    } catch (error) {
      await storage.remove([storagePath]).catch(() => undefined);
      throw error;
    }

    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/courses");
    revalidatePath("/gallery");
    revalidatePath("/api/public/site-logo");
    revalidateTag("public-content", "max");
    return NextResponse.json({ ok: true, path: storagePath, url: storage.getPublicUrl(storagePath).data.publicUrl }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Could not save the image. Check the Supabase media bucket and database migration, then try again.");
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if ((actor.role !== "super_admin" && actor.role !== "admin")) return NextResponse.json({ error: "School administrator access required" }, { status: 403 });
    const limited = await rateLimit("admin-media", actor.id, 30, "10 m");
    if (!limited.ok) return tooManyRequests(limited.retryAfter);
    const parsed = assignSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid library image, website location, and accessibility description." }, { status: 400 });
    await db.insert(siteImages).values({
      slot: parsed.data.slot,
      storagePath: parsed.data.path,
      altText: parsed.data.altText,
      updatedBy: actor.id,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: siteImages.slot,
      set: { storagePath: parsed.data.path, altText: parsed.data.altText, updatedBy: actor.id, updatedAt: new Date() },
    });
    await db.insert(auditLogs).values({
      actorId: actor.id,
      action: "replace_site_image",
      entityType: "site_media",
      after: { slot: parsed.data.slot, storagePath: parsed.data.path },
    });
    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/courses");
    revalidatePath("/gallery");
    revalidatePath("/api/public/site-logo");
    revalidateTag("public-content", "max");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Could not set this image on the website.");
  }
}
