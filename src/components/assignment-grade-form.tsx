"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";

export function AssignmentGradeForm({ assignmentId, submissionId, maxScore, score, feedback }: { assignmentId: string; submissionId: string; maxScore: number; score: number | null; feedback: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/portal/assignments/${assignmentId}/submissions`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, score: Number(values.get("score")), feedback: values.get("feedback") }) });
      const data = await response.json(); if (!response.ok) { setError(data.error ?? "Could not save the grade."); return; }
      router.refresh();
    } catch { setError("Could not reach the grading service."); }
    finally { setBusy(false); }
  }
  return <form className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_auto]" onSubmit={submit}>
    <GlassInput name="score" type="number" min={0} max={maxScore} defaultValue={score ?? ""} placeholder={`/${maxScore}`} required />
    <GlassInput name="feedback" defaultValue={feedback ?? ""} maxLength={3000} placeholder="Feedback for the student" />
    <GlassButton type="submit" disabled={busy}>{busy ? "Saving…" : "Save grade"}</GlassButton>
    {error && <p role="alert" className="text-xs text-red-700 sm:col-span-3">{error}</p>}
  </form>;
}
