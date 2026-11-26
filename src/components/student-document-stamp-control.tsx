"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StudentDocumentStampControl({
  studentId,
  stampedAt,
  stamperName,
  stamperTitle,
}: {
  studentId: string;
  stampedAt: string | null;
  stamperName: string | null;
  stamperTitle: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  async function stampDocuments() {
    if (name.trim().length < 2) {
      setError("Enter the authorized signatory name to print on the DLA stamp.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/academic/students/${studentId}/document-stamp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stamperName: name.trim() }) });
      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not stamp the student documents.");
        return;
      }
      setName("");
      router.refresh();
    } catch {
      setError("Could not reach the document-stamping service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid justify-items-start gap-1">
      {stampedAt ? (
        <span className="text-xs opacity-70">
          Stamped {stampedAt} by {stamperName} · {stamperTitle}
        </span>
      ) : (
        <span className="text-xs text-[var(--warning)]">Not stamped</span>
      )}
      <label className="grid max-w-64 gap-1 text-xs font-semibold">Authorized signatory name
        <input className="glass rounded-lg px-2 py-1.5 text-sm" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="name" placeholder="Type the name to print" />
      </label>
      <button
        className="text-sm font-semibold text-[var(--brand-primary)] hover:underline disabled:opacity-50"
        type="button"
        onClick={() => void stampDocuments()}
        disabled={busy || name.trim().length < 2}
      >
        {busy ? "Saving stamp…" : stampedAt ? "Update official stamp" : "Stamp ID and report cards"}
      </button>
      {error && <span className="max-w-60 text-xs text-[var(--danger)]" role="alert">{error}</span>}
    </div>
  );
}
