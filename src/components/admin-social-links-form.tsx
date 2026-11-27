"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";
import { SOCIAL_SLOTS, type SocialLinks } from "@/lib/social-link-types";

export function AdminSocialLinksForm({ links }: { links: SocialLinks }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/admin/social-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: SOCIAL_SLOTS.map(({ id }) => ({ slot: id, url: form.get(id) })) }),
      });
      const result = await response.json() as { error?: string | { fieldErrors?: Record<string, string[]> } };
      if (!response.ok) {
        const message = typeof result.error === "string" ? result.error : Object.values(result.error?.fieldErrors ?? {}).flat()[0];
        throw new Error(message ?? "Check that each link belongs to the social network shown beside it.");
      }
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save social links.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <p className="text-sm text-[var(--text-muted)]">Add the public profile links. Leave a network blank to hide it from the website.</p>
      {SOCIAL_SLOTS.map((slot) => (
        <label className="grid gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center" key={slot.id}>
          <span className="font-bold">{slot.name}</span>
          <GlassInput name={slot.id} aria-label={`${slot.name} profile URL`} type="url" maxLength={500}
            placeholder={slot.placeholder} defaultValue={links.find((item) => item.slot === slot.id)?.url ?? ""} />
        </label>
      ))}
      <GlassButton type="submit" disabled={busy}>{busy ? "Saving…" : "Save social links"}</GlassButton>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {saved && <p className="text-sm text-[var(--success)]" role="status">Social links saved and updated on the public site.</p>}
    </form>
  );
}
