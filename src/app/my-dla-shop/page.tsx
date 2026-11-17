import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { shopProducts } from "@/db/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My DLA Shop", description: "Browse DLA clothing, caps and creative work by our students." };

export default async function MyDlaShopPage() {
  const products = await db.select().from(shopProducts).where(eq(shopProducts.published, true)).orderBy(asc(shopProducts.category), asc(shopProducts.createdAt));
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <header className="mb-8"><p className="font-bold uppercase tracking-widest text-[var(--brand-secondary)]">Made with DLA spirit</p><h1 className="mt-2 text-4xl">My DLA Shop</h1><p className="mt-3 max-w-2xl text-[var(--text-muted)]">Wear your learning proudly and support the creativity of our school community. Browse T shirts, light jackets, caps and artwork created by DLA students.</p></header>
    {products.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <GlassCard key={product.id} className="overflow-hidden">
      <img src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full border-b border-[var(--border)] object-cover" />
      <div className="p-5"><p className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">{product.category}</p><h2 className="mt-1 text-2xl">{product.name}</h2><p className="mt-2 text-[var(--text-muted)]">{product.description}</p><p className="mt-4 text-xl font-bold text-[#174f8a]">{product.currency} {Number(product.price).toLocaleString()}</p><Link href={`/contact?shopItem=${encodeURIComponent(product.name)}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--brand-secondary)] px-4 py-2 font-bold text-white hover:opacity-90">Ask about this item</Link></div>
    </GlassCard>)}</div> : <GlassCard strong className="p-7"><h2 className="text-2xl">The shop is getting ready</h2><p className="mt-2 text-[var(--text-muted)]">New DLA clothing and student artwork will appear here soon.</p><Link className="mt-4 inline-block font-bold underline" href="/contact">Contact us about DLA merchandise</Link></GlassCard>}
  </main>;
}
