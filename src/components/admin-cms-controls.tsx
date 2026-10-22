"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";

export function AdminNewsCreate() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/cms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          slug: data.get("slug"),
          excerpt: data.get("excerpt"),
          body: data.get("body"),
          status: data.get("status"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not save this website update.");
        return;
      }
      setSuccess(`Website update saved as ${result.post.status}.`);
      form.reset();
      router.refresh();
    } catch {
      setError("Unable to save the website update.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <GlassInput name="title" placeholder="News/update title" maxLength={180} required />
      <GlassInput name="slug" placeholder="Website slug (optional)" maxLength={128} />
      <GlassInput name="excerpt" placeholder="Short preview (optional)" maxLength={500} />
      <textarea className="glass min-h-36 w-full rounded-xl px-4 py-3 text-sm" name="body" placeholder="Website update" maxLength={20000} required />
      <select className="glass w-full rounded-xl px-3 py-2.5" name="status" defaultValue="draft">
        <option value="draft">Save as draft</option><option value="published">Publish to website</option>
      </select>
      <GlassButton type="submit" disabled={busy}>{busy ? "Saving..." : "Save website update"}</GlassButton>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {success && <p className="text-sm text-[var(--success)]" role="status">{success}</p>}
    </form>
  );
}

export function AdminReviewDecision({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(action: "approve_review" | "reject_review") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/cms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewId }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not update review status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to update this review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="text-xs font-semibold underline" disabled={busy} onClick={() => void decide("approve_review")}>Approve</button>
      <button className="text-xs font-semibold underline" disabled={busy} onClick={() => void decide("reject_review")}>Reject</button>
      {error && <span className="text-xs text-[var(--danger)]" role="alert">{error}</span>}
    </div>
  );
}
