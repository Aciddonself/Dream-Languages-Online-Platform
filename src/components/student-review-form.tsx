"use client";

import { useState, type FormEvent } from "react";
import { GlassButton } from "@/components/ui/glass";

export function StudentReviewForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/portal/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: data.get("quote"), rating: Number(data.get("rating")) }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not submit your review.");
        return;
      }
      setMessage(result.message);
      form.reset();
    } catch {
      setError("Unable to submit your review. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <textarea className="glass min-h-32 w-full rounded-xl px-4 py-3 text-sm" name="quote" maxLength={1000} placeholder="Write your review or comment about learning at DLA" required minLength={10} />
      <select className="glass rounded-xl px-3 py-2.5 text-sm" name="rating" defaultValue="5">
        <option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option>
      </select>
      <p className="text-xs opacity-65">Your review/comment stays private until an administrator approves it. Phone numbers and contact details are not allowed.</p>
      <GlassButton type="submit" disabled={busy}>{busy ? "Submitting..." : "Submit review for approval"}</GlassButton>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {message && <p className="text-sm text-[var(--success)]" role="status">{message}</p>}
    </form>
  );
}
