"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { GlassButton } from "@/components/ui/glass";
import type { SITE_IMAGE_SLOTS, SiteImageSlotId } from "@/lib/site-image-slots";

type Slot = { id: SiteImageSlotId; label: string; fallback: string; alt: string; url: string | null; altText: string; updatedAt: string | null };
type Asset = { path: string; name: string; url: string; createdAt: string | null };

export function CmsMediaLibrary({ slots: initialSlots }: { slots: typeof SITE_IMAGE_SLOTS }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [slots, setSlots] = useState<Slot[]>(initialSlots.map((slot) => ({ ...slot, url: null, altText: slot.alt, updatedAt: null })));
  const [selectedSlot, setSelectedSlot] = useState<SiteImageSlotId | "none">("none");
  const [altText, setAltText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/media", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Could not load media (${response.status}).`);
      setAssets(data.assets ?? []);
      setSlots(data.slots ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the media library.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/media", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? `Could not load media (${response.status}).`);
        if (!cancelled) { setAssets(data.assets ?? []); setSlots(data.slots ?? []); }
      })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the media library."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function onSlotChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value as SiteImageSlotId | "none";
    setSelectedSlot(value);
    setAltText(value === "none" ? "" : slots.find((slot) => slot.id === value)?.altText ?? "");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file) { setError("Choose an image to upload."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("slot", selectedSlot);
      form.set("altText", altText);
      const response = await fetch("/api/admin/media", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Upload failed (${response.status}).`);
      setMessage(selectedSlot === "none" ? "Image added to the media library." : "Image uploaded and published to the selected website location.");
      setFile(null);
      formElement.reset();
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Image upload failed."); }
    finally { setBusy(false); }
  }

  async function assign(asset: Asset) {
    if (selectedSlot === "none") { setError("Choose a website location before using a library image."); return; }
    if (!altText.trim()) { setError("Add an image description for accessibility."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/media", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: asset.path, slot: selectedSlot, altText }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `Could not set image (${response.status}).`);
      setMessage("Selected library image is now published in that website location.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not set this image."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <form className="grid gap-4 rounded-2xl border border-white/10 p-4 md:grid-cols-2" onSubmit={upload}>
      <label className="grid gap-2 text-sm font-semibold">Image location
        <select className="glass rounded-xl px-3 py-3" value={selectedSlot} onChange={onSlotChange}>
          <option value="none">Upload only, do not publish yet</option>
          {slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold">Image description for screen readers
        <input className="glass rounded-xl px-3 py-3 font-normal" value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={180} placeholder="Describe what the image shows" required={selectedSlot !== "none"} />
      </label>
      <label className="grid gap-2 text-sm font-semibold md:col-span-2">Choose image, up to 12 MB
        <input className="glass rounded-xl px-3 py-3 font-normal" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
        <span className="text-xs font-normal opacity-65">Images are resized and converted to WebP before storage.</span>
      </label>
      <div className="md:col-span-2"><GlassButton type="submit" disabled={busy}>{busy ? "Saving image…" : "Upload image"}</GlassButton></div>
    </form>

    {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
    {message && <p role="status" className="text-sm text-[var(--success)]">{message}</p>}

    <div>
      <h3 className="mb-3 font-semibold">Website image locations</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{slots.map((slot) => <article key={slot.id} className="overflow-hidden rounded-2xl border border-white/10">
        <div className="relative aspect-[16/9] bg-black/10"><Image src={slot.url ?? slot.fallback} alt={slot.altText} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover" unoptimized={Boolean(slot.url)} /></div>
        <div className="p-3"><p className="font-semibold">{slot.label}</p><p className="mt-1 text-xs opacity-65">{slot.url ? "Custom image active" : "Using default image"}</p></div>
      </article>)}</div>
    </div>

    <div>
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">Media library ({assets.length})</h3><GlassButton type="button" variant="glass" onClick={() => void load()} disabled={loading}>Refresh</GlassButton></div>
      {loading ? <p className="text-sm opacity-65">Loading images…</p> : assets.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{assets.map((asset) => <article key={asset.path} className="overflow-hidden rounded-2xl border border-white/10">
        <div className="relative aspect-[4/3] bg-black/10"><Image src={asset.url} alt={asset.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="object-cover" unoptimized /></div>
        <div className="space-y-2 p-3"><p className="truncate text-xs opacity-70">{asset.name}</p><GlassButton type="button" variant="glass" className="w-full" disabled={busy || selectedSlot === "none"} onClick={() => void assign(asset)}>Use in selected location</GlassButton></div>
      </article>)}</div> : <p className="text-sm opacity-65">No uploaded images yet. Choose an image above to get started.</p>}
      {selectedSlot === "none" && <p className="mt-2 text-xs opacity-65">Choose a website location above to enable “Use in selected location.”</p>}
    </div>
  </div>;
}
