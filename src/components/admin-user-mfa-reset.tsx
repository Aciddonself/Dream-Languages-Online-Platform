"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminUserMfaReset({ userId, disabled = false }: { userId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function reset() {
    if (!window.confirm("Reset this user's authenticator? This signs them out and requires them to scan a new QR code at their next login.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-mfa`, { method: "POST" });
      const result = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Could not reset this authenticator.");
        return;
      }
      setMessage(result.message ?? "Authenticator reset. The user will scan a new QR code next time.");
      router.refresh();
    } catch {
      setMessage("Could not reach the authenticator service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid gap-1">
    <button type="button" onClick={reset} disabled={disabled || busy} className="font-semibold underline disabled:opacity-50">
      {busy ? "Resetting…" : "Reset authenticator"}
    </button>
    {message && <span role="status" className="max-w-48 text-xs opacity-75">{message}</span>}
  </div>;
}
