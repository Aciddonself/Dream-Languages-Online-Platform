"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function sendAction(userId: string, payload: Record<string, string>) {
  const response = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  });
  const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (HTTP ${response.status}).`);
  return data;
}

export function AdminUserArchiveButton({ userId, name, isSelf, archived }: { userId: string; name: string; isSelf: boolean; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (isSelf || archived) return null;

  async function archive() {
    if (!window.confirm(`Archive ${name}? They will no longer be able to sign in. Their learning and payment history will be retained.`)) return;
    setBusy(true);
    setError("");
    try {
      await sendAction(userId, { action: "set_status", status: "archived" });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not archive this user.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid gap-1"><button type="button" onClick={() => void archive()} disabled={busy} className="rounded-lg border border-red-300/40 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-50">{busy ? "Archiving…" : "Archive user"}</button>{error && <span role="alert" className="max-w-56 text-xs text-red-300">{error}</span>}</div>;
}

export function AdminUserPermanentDelete({ userId, email, canDelete }: { userId: string; email: string; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!canDelete) return null;

  async function permanentlyDelete() {
    const confirmation = window.prompt(`This permanently removes the archived account ${email}. Related school records are retained and may prevent deletion. Type DELETE to continue.`);
    if (confirmation !== "DELETE") return;
    setBusy(true);
    setError("");
    try {
      const result = await sendAction(userId, { action: "permanently_delete", confirmation: "PERMANENTLY DELETE" });
      if (result.message) setError(result.message);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not permanently delete this archived account.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid gap-1"><button type="button" onClick={() => void permanentlyDelete()} disabled={busy} className="rounded-lg border border-red-400/60 px-3 py-1.5 text-xs font-bold text-red-200 disabled:opacity-50">{busy ? "Deleting…" : "Permanently delete"}</button>{error && <span role="alert" className="max-w-60 text-xs text-red-300">{error}</span>}</div>;
}
