"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const choices = [
  { value: "active", label: "Activate / reactivate" },
  { value: "on_hold", label: "Hold" },
  { value: "paused", label: "Pause" },
  { value: "withdrawn", label: "Discontinue" },
  { value: "archived", label: "Archive as gone; retain role" },
] as const;

export function AdminUserStatus({
  userId,
  status,
  isSelf,
}: {
  userId: string;
  status: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (isSelf) return <span className="text-xs opacity-60">Your administrator account is protected</span>;

  async function changeStatus(nextStatus: string) {
    if (nextStatus === status) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", userId, status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not update account.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update account. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Account status" className="glass max-w-52 px-2 py-1.5 text-xs" value={status} disabled={busy} onChange={(event) => void changeStatus(event.target.value)}>
        {!choices.some((choice) => choice.value === status) && <option value={status}>Current: {status.replaceAll("_", " ")}</option>}
        {choices.filter((choice) => choice.value === status || (status === "archived" ? choice.value === "active" : true)).map((choice) => <option value={choice.value} key={choice.value}>{choice.label}</option>)}
      </select>
      {error && <span className="text-xs text-[var(--danger)]" role="alert">{error}</span>}
    </div>
  );
}
