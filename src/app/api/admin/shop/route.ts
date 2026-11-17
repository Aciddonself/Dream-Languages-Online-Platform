import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, shopProducts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mediaIsShopUrl = (value: string) => {
  try {
    const url = new URL(value); const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder-project.supabase.co");
    return url.protocol === "https:" && url.hostname === project.hostname && url.pathname.includes("/storage/v1/object/public/site-media/shop/") && /\.(jpg|png|webp|gif)(\?|$)/i.test(url.pathname);
  } catch { return false; }
};
const base = z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().min(5).max(1200), category: z.string().trim().min(2).max(80), imageUrl: z.string().trim().url().max(1000), price: z.coerce.number().positive().max(1_000_000_000), currency: z.enum(["UGX", "USD"]).default("UGX"), published: z.boolean().default(false) }).strict();
const createSchema = z.object({ action: z.literal("create"), ...base.shape }).strict();
const updateSchema = z.object({ action: z.literal("update"), id: z.string().uuid(), ...base.shape }).strict();
const removeSchema = z.object({ action: z.literal("delete"), id: z.string().uuid() }).strict();

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  const products = await db.select().from(shopProducts).orderBy(desc(shopProducts.createdAt)).limit(100);
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const action = (body as { action?: unknown } | null)?.action;
  if (action === "delete") {
    const parsed = removeSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const [deleted] = await db.delete(shopProducts).where(eq(shopProducts.id, parsed.data.id)).returning({ id: shopProducts.id, name: shopProducts.name });
    if (!deleted) return NextResponse.json({ error: "Shop item not found." }, { status: 404 });
    await db.insert(auditLogs).values({ actorId: actor.id, action: "delete_shop_product", entityType: "shop_product", entityId: deleted.id, before: deleted, after: null });
    return NextResponse.json({ ok: true });
  }
  if (action === "update") {
    const parsed = updateSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    if (!mediaIsShopUrl(parsed.data.imageUrl)) return NextResponse.json({ error: "Upload the item image to the DLA shop media library." }, { status: 400 });
    const [existing] = await db.select().from(shopProducts).where(eq(shopProducts.id, parsed.data.id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Shop item not found." }, { status: 404 });
    const { action: _action, id, ...fields } = parsed.data;
    const [updated] = await db.update(shopProducts).set({ ...fields, updatedAt: new Date() }).where(eq(shopProducts.id, id)).returning();
    await db.insert(auditLogs).values({ actorId: actor.id, action: "update_shop_product", entityType: "shop_product", entityId: id, before: existing, after: updated });
    return NextResponse.json({ ok: true, product: updated });
  }
  const parsed = createSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!mediaIsShopUrl(parsed.data.imageUrl)) return NextResponse.json({ error: "Upload the item image to the DLA shop media library." }, { status: 400 });
  const { action: _action, ...fields } = parsed.data;
  const [product] = await db.insert(shopProducts).values({ ...fields, createdBy: actor.id }).returning();
  await db.insert(auditLogs).values({ actorId: actor.id, action: "create_shop_product", entityType: "shop_product", entityId: product.id, after: product });
  return NextResponse.json({ ok: true, product }, { status: 201 });
}
