"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Attempt = { id: string; examId: string; studentId: string; studentName: string; examTitle: string; score: number | null; submittedAt: Date | string | null; published: boolean | null };

export function AssessmentAttempts({ attempts }: { attempts: Attempt[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  async function publish(attempt: Attempt) {
    if (attempt.score === null) return;
    setBusyId(attempt.id); setError("");
    try {
      const response = await fetch("/api/academic/results", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: attempt.examId, studentId: attempt.studentId, score: attempt.score, comments: "Auto-graded online multiple-choice assessment." }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not publish this result.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not publish this result."); }
    finally { setBusyId(""); }
  }

  return <div className="space-y-3">
    {attempts.length ? attempts.map((attempt) => <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm">
      <div><div className="font-semibold">{attempt.examTitle} · {attempt.studentName}</div><div className="opacity-65">Score: {attempt.score ?? "Pending"}% · Submitted {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "—"}</div></div>
      {attempt.published ? <span className="text-emerald-700">Result published</span> : <button type="button" disabled={busyId === attempt.id || attempt.score === null} onClick={() => void publish(attempt)} className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 font-semibold text-white disabled:opacity-50">{busyId === attempt.id ? "Publishing…" : "Review and publish"}</button>}
    </div>) : <p className="text-sm opacity-65">No submitted online assessments are awaiting review.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
