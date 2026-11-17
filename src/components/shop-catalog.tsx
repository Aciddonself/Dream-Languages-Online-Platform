"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass";
import type { shopProducts } from "@/db/schema";

type Product = typeof shopProducts.$inferSelect;

export function ShopCatalog({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const selected = useMemo(() => products.filter((product) => cart[product.id]), [products, cart]);
  const count = selected.reduce((sum, product) => sum + cart[product.id], 0);
  const total = selected.reduce((sum, product) => sum + Number(product.price) * cart[product.id], 0);
  const orderSummary = selected.map((product) => `${product.name} x${cart[product.id]}`).join(", ");

  function changeQuantity(id: string, difference: number) {
    setCart((current) => {
      const next = Math.max(0, (current[id] ?? 0) + difference);
      const updated = { ...current };
      if (next) updated[id] = next;
      else delete updated[id];
      return updated;
    });
  }

  return <>
    {count > 0 && <aside className="mb-6 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-4 shadow-xl sm:p-5" aria-label="Your shopping cart">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--brand-secondary)] text-white"><ShoppingCart size={21} /></span><div><h2 className="text-xl">Your cart · {count} {count === 1 ? "item" : "items"}</h2><p className="text-sm text-[var(--text-muted)]">Estimated total: UGX {total.toLocaleString()}</p></div></div>
        <Link href={`/contact?shopItem=${encodeURIComponent(orderSummary)}`} className="inline-flex min-h-11 items-center rounded-xl bg-[var(--brand-secondary)] px-4 py-2 font-bold text-white hover:opacity-90">Ask to order</Link>
      </div>
      <ul className="mt-4 divide-y divide-[var(--border)]">{selected.map((product) => <li key={product.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="font-semibold">{product.name} · {product.currency} {(Number(product.price) * cart[product.id]).toLocaleString()}</span><div className="flex items-center gap-2"><button type="button" onClick={() => changeQuantity(product.id, -1)} aria-label={`Remove one ${product.name}`} className="site-icon-button rounded-lg p-2"><Minus size={16} /></button><span className="min-w-5 text-center font-bold">{cart[product.id]}</span><button type="button" onClick={() => changeQuantity(product.id, 1)} aria-label={`Add one ${product.name}`} className="site-icon-button rounded-lg p-2"><Plus size={16} /></button><button type="button" onClick={() => changeQuantity(product.id, -cart[product.id])} aria-label={`Remove ${product.name} from cart`} className="site-icon-button rounded-lg p-2"><Trash2 size={16} /></button></div></li>)}</ul>
      <p className="mt-3 text-xs text-[var(--text-muted)]">Send your cart to the DLA team on WhatsApp to confirm availability and payment.</p>
    </aside>}
    {products.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <GlassCard key={product.id} className="overflow-hidden">
      <div className="relative mx-auto aspect-[4/3] max-h-[300px] bg-[var(--surface)]"><Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="border-b border-[var(--border)] object-contain p-2" /></div>
      <div className="p-5"><p className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">{product.category}</p><h2 className="mt-1 text-2xl">{product.name}</h2><p className="mt-2 text-[var(--text-muted)]">{product.description}</p><p className="mt-4 text-xl font-bold text-[#174f8a]">{product.currency} {Number(product.price).toLocaleString()}</p><button type="button" onClick={() => changeQuantity(product.id, 1)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand-secondary)] px-4 py-2 font-bold text-white hover:opacity-90"><ShoppingCart size={18} /> Add to cart</button></div>
    </GlassCard>)}</div> : <GlassCard strong className="p-7"><h2 className="text-2xl">The shop is getting ready</h2><p className="mt-2 text-[var(--text-muted)]">New DLA clothing and student artwork will appear here soon.</p><Link className="mt-4 inline-block font-bold underline" href="/contact">Contact us about DLA merchandise</Link></GlassCard>}
  </>;
}
