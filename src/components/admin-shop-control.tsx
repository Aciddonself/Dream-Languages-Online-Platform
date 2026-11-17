"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GlassButton, GlassInput } from "@/components/ui/glass";
import { uploadSiteMedia } from "@/components/admin-cms-controls";

type Product = { id: string; name: string; description: string; category: string; imageUrl: string; price: string; currency: "UGX" | "USD"; published: boolean };
type ShopForm = Omit<Product, "id"> & { price: string };
const empty: ShopForm = { name: "", description: "", category: "Clothing", imageUrl: "", price: "", currency: "UGX", published: false };

export function AdminShopControl() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/shop", { cache: "no-store" });
    const result = await response.json() as { products?: Product[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Could not load shop items.");
    setProducts(result.products ?? []);
  }
  useEffect(() => { void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load shop items.")); }, []);

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]; if (!file) return;
    setUploading(true); setError("");
    try { const imageUrl = await uploadSiteMedia(file, "shop"); setForm((current) => ({ ...current, imageUrl })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not upload the shop photo."); }
    finally { setUploading(false); event.currentTarget.value = ""; }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: editing ? "update" : "create", ...(editing ? { id: editing } : {}), ...form, price: Number(form.price) }) });
      const result = await response.json() as { error?: string | { fieldErrors?: Record<string, string[]> } };
      if (!response.ok) { const e = result.error; throw new Error(typeof e === "string" ? e : Object.values(e?.fieldErrors ?? {}).flat()[0] ?? "Could not save the item."); }
      setMessage(editing ? "Shop item updated." : "Shop item added."); setForm(empty); setEditing(null); await refresh(); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this item."); }
    finally { setBusy(false); }
  }

  async function edit(product: Product) {
    setEditing(product.id);
    setForm({ name: product.name, description: product.description, category: product.category, imageUrl: product.imageUrl, price: String(product.price), currency: product.currency, published: product.published });
  }

  async function remove(product: Product) {
    if (!window.confirm(`Remove “${product.name}” from My DLA Shop?`)) return;
    setError("");
    try {
      const response = await fetch("/api/admin/shop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: product.id }) });
      const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error ?? "Could not remove this item.");
      await refresh(); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove this item."); }
  }

  return <div className="grid gap-5">
    <form className="grid gap-3 rounded-2xl border border-[var(--border-strong)] p-4" onSubmit={save}>
      <p className="text-sm text-[var(--text-muted)]">Add student artwork, T shirts, light jackets, caps and other DLA items with a photo and price.</p>
      <GlassInput aria-label="Item name" placeholder="Item name, for example DLA cap" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={120} required />
      <textarea aria-label="Item description" placeholder="Describe this item" className="glass min-h-24 w-full rounded-xl p-3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={1200} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <GlassInput aria-label="Category" placeholder="Category, for example Artwork" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} maxLength={80} required />
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2"><GlassInput aria-label="Price" type="number" min="1" step="0.01" placeholder="Price" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /><select aria-label="Price currency" className="glass rounded-xl px-2" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as "UGX" | "USD" })}><option>UGX</option><option>USD</option></select></div>
      </div>
      <label className="grid gap-2 text-sm font-bold">Item photo <input className="glass w-full rounded-xl p-3" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseImage} /></label>
      {form.imageUrl && <img src={form.imageUrl} alt="Shop item preview" className="max-h-56 w-full rounded-xl border border-[var(--border)] object-contain" />}
      <label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} />Show this item in My DLA Shop</label>
      <div className="flex flex-wrap gap-2"><GlassButton type="submit" disabled={busy || uploading || !form.imageUrl}>{busy ? "Saving…" : editing ? "Update item" : "Add item"}</GlassButton>{editing && <button type="button" className="rounded-xl border px-4 py-2" onClick={() => { setEditing(null); setForm(empty); }}>Cancel edit</button>}</div>
      {uploading && <p className="text-sm">Uploading photo…</p>}{error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}{message && <p role="status" className="text-sm text-[var(--success)]">{message}</p>}
    </form>
    <div className="grid gap-3 sm:grid-cols-2">{products.map((product) => <article key={product.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl border border-[var(--border)] p-3">
      <img src={product.imageUrl} alt={product.name} className="h-20 w-20 rounded-lg bg-[var(--surface)] object-contain p-1" />
      <div className="min-w-0"><h3 className="truncate text-base">{product.name}</h3><p className="text-sm">{product.currency} {Number(product.price).toLocaleString()}</p><p className="text-xs text-[var(--text-muted)]">{product.published ? "Published" : "Draft"}</p><div className="mt-2 flex gap-3"><button type="button" className="underline" onClick={() => void edit(product)}>Edit</button><button type="button" className="underline" onClick={() => void remove(product)}>Delete</button></div></div>
    </article>)}</div>
  </div>;
}
