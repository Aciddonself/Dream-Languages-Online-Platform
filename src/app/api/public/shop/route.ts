import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopProducts } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await db.select({ id: shopProducts.id, name: shopProducts.name, description: shopProducts.description, category: shopProducts.category, imageUrl: shopProducts.imageUrl, price: shopProducts.price, currency: shopProducts.currency })
    .from(shopProducts).where(eq(shopProducts.published, true)).orderBy(asc(shopProducts.category), asc(shopProducts.createdAt));
  return NextResponse.json({ products }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
