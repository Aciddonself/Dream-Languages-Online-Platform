"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlassButton } from "@/components/ui/glass";

export function AssignmentSubmissionForm({ assignmentId, disabled }: { assignmentId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/portal/assignments/${assignmentId}/submissions`, { method: "POST", body: new FormData(form) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Could not submit the assignment."); return; }
      setMessage("Your work has been submitted."); router.refresh();
    } catch { setError("Could not reach the submission service."); }
    finally { setBusy(false); }
  }
  return <form className="mt-4 grid gap-3" onSubmit={submit}>
    <label className="grid gap-1 text-sm">Written response<textarea name="text" maxLength={20000} rows={4} className="glass rounded-xl px-3 py-2 text-sm" placeholder="Write your response here" /></label>
    <label className="grid gap-1 text-sm">Attach a document, image, or audio recording<input name="file" type="file" accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.wav,.weba,audio/*" className="glass rounded-xl px-3 py-2 text-sm" /></label>
    <p className="text-xs opacity-65">Maximum file size 20 MB. Accepted formats: PDF, Word, text, images, and audio. You may resubmit until the deadline or until your work is graded.</p>
    <GlassButton type="submit" disabled={busy || disabled}>{busy ? "Submitting…" : "Submit / resubmit work"}</GlassButton>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
  </form>;
}
