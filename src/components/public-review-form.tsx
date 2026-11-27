"use client";

import { useState, type FormEvent } from "react";

export function PublicReviewForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/public/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: values.get("authorName"),
          role: values.get("role"),
          quote: values.get("quote"),
          rating: Number(values.get("rating")),
          website: values.get("website"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not submit your review.");
        return;
      }
      setMessage(result.message ?? "Thank you. Your review is waiting for approval.");
      form.reset();
    } catch {
      setError("Unable to submit your review. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void submit(event)}>
      <label className="grid gap-1 text-sm font-semibold">
        Your name
        <input name="authorName" autoComplete="name" maxLength={80} required className="glass rounded-xl px-3 py-2.5" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        How you know DLA
        <select name="role" defaultValue="Learner" className="glass rounded-xl px-3 py-2.5">
          <option>Learner</option>
          <option>Parent or guardian</option>
          <option>Community member</option>
          <option>Other</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold md:col-span-2">
        Your review
        <textarea name="quote" minLength={10} maxLength={1000} required rows={4} className="glass min-h-32 w-full rounded-xl px-3 py-2.5" placeholder="Tell us about your experience with Dream Languages." />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Your rating
        <select name="rating" defaultValue="5" className="glass rounded-xl px-3 py-2.5" aria-label="Rating out of five stars">
          <option value="5">5 stars</option>
          <option value="4">4 stars</option>
          <option value="3">3 stars</option>
          <option value="2">2 stars</option>
          <option value="1">1 star</option>
        </select>
      </label>
      <label className="sr-only" aria-hidden="true">
        Leave this field empty
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <div className="flex flex-col items-start justify-end gap-2">
        <button type="submit" disabled={busy} className="btn-glass btn-glass-primary min-h-11 rounded-xl px-5 py-2.5 font-bold disabled:opacity-60">
          {busy ? "Sending review…" : "Send review"}
        </button>
      </div>
      <p className="text-sm md:col-span-2">Your review will stay private until the DLA administrator or Head of Academics approves it. Please do not include phone numbers or private contact details.</p>
      {error && <p role="alert" className="text-sm text-[var(--danger)] md:col-span-2">{error}</p>}
      {message && <p role="status" className="text-sm text-[var(--success)] md:col-span-2">{message}</p>}
    </form>
  );
}
