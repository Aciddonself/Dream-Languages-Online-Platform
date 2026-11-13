"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";
import type { TikTokLinks } from "@/lib/social-links";

export function AdminTikTokLinksForm({ links }: { links: TikTokLinks }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/admin/social-links", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: [0, 1].map((index) => ({ label: data.get(`label-${index}`), url: data.get(`url-${index}`) })) }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Enter two valid TikTok profile links.");
      setSaved(true); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save TikTok links."); }
    finally { setBusy(false); }
  }
  return (
    <form className="grid gap-4" onSubmit={submit}>
      {links.map((link, index) => <fieldset key={index} className="grid gap-2 rounded-xl border border-white/10 p-3"><legend className="px-1 text-sm font-medium">TikTok account {index + 1}</legend><GlassInput name={`label-${index}`} aria-label={`TikTok account ${index + 1} display name`} defaultValue={link.label} required maxLength={60} /><GlassInput name={`url-${index}`} aria-label={`TikTok account ${index + 1} URL`} defaultValue={link.url} type="url" required maxLength={300} placeholder="https://www.tiktok.com/@your-account" /></fieldset>)}
      <p className="text-xs opacity-65">Use TikTok profile links only. Saving updates the links shown to public site visitors.</p>
      <GlassButton type="submit" disabled={busy}>{busy ? "Saving…" : "Save social accounts"}</GlassButton>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}{saved && <p className="text-sm text-[var(--success)]" role="status">Social links saved.</p>}
    </form>
  );
}
