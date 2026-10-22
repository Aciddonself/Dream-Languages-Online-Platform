"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassButton } from "@/components/ui/glass";

export function TeacherApplicationReview({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateStatus(nextStatus: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/volunteer-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not update application.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to update application. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs opacity-70">Status: {status.replaceAll("_", " ")}</span>
      <GlassButton type="button" disabled={busy || status === "shortlisted"} onClick={() => void updateStatus("shortlisted")}>Shortlist</GlassButton>
      <GlassButton type="button" variant="glass" disabled={busy || status === "rejected"} onClick={() => void updateStatus("rejected")}>Reject</GlassButton>
      {error && <span className="text-xs text-[var(--danger)]" role="alert">{error}</span>}
    </div>
  );
}
