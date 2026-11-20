import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { ShopCatalog } from "@/components/shop-catalog";
import { db } from "@/db";
import { shopProducts } from "@/db/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My DLA Shop", description: "Browse DLA clothing, caps and creative work by our students." };

export default async function MyDlaShopPage() {
  const products = await db.select().from(shopProducts).where(eq(shopProducts.published, true)).orderBy(asc(shopProducts.category), asc(shopProducts.createdAt));
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <section className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-5 shadow-xl sm:p-8">
      <header className="mb-8"><p className="font-bold uppercase tracking-widest text-[var(--brand-secondary)]">Made with DLA spirit</p><h1 className="mt-2 text-4xl">My DLA Shop</h1><p className="mt-3 max-w-2xl text-[var(--text-muted)]">Wear your learning proudly and support the creativity of our school community. Browse T shirts, light jackets, caps and artwork created by DLA students.</p></header>
      <ShopCatalog products={products} />
    </section>
  </main>;
}
