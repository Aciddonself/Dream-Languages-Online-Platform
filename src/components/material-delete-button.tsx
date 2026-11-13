"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MaterialDeleteButton({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (!window.confirm("Delete this learning material for every student in the class?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/portal/materials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ materialId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not delete the material.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the material.");
    } finally { setBusy(false); }
  }
  return <span className="grid justify-items-end gap-1"><button type="button" className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10" onClick={() => void remove()} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>{error && <span className="text-xs text-[var(--danger)]" role="alert">{error}</span>}</span>;
}
