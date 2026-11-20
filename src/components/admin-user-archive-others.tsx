"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminUserArchiveOthers() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function archiveAccounts() {
    const confirmation = window.prompt(
      "This will disable every account except your current super admin account. Account and learning records will be retained. Type ARCHIVE OTHER ACCOUNTS to continue.",
    );
    if (confirmation !== "ARCHIVE OTHER ACCOUNTS") return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive_others", confirmation }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.message === "string" ? result.message : "Could not archive the other accounts.");
        if (result.archivedCount > 0) router.refresh();
        return;
      }
      setMessage(`${result.archivedCount} other account${result.archivedCount === 1 ? "" : "s"} archived. Their records are retained.`);
      router.refresh();
    } catch {
      setError("Could not archive accounts. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 sm:flex sm:items-center">
      <button
        type="button"
        className="btn-glass inline-flex min-h-11 items-center justify-center px-4 py-2 font-bold"
        disabled={busy}
        onClick={() => void archiveAccounts()}
      >
        {busy ? "Archiving accounts…" : "Keep only my super admin account"}
      </button>
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  );
}
