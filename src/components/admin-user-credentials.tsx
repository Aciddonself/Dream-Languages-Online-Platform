"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminUserCredentials({ userId }: { userId: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_password", userId, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not issue account credentials.");
        return;
      }
      setPassword("");
      setMessage("Password issued. Share it with the user securely.");
      router.refresh();
    } catch {
      setError("Unable to issue credentials. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid min-w-52 gap-1" onSubmit={submit}>
      <div className="flex gap-1">
        <input
          aria-label="New user password"
          autoComplete="new-password"
          className="glass min-w-0 flex-1 rounded-lg px-2 py-1 text-xs"
          minLength={10}
          maxLength={256}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Set password (12+ chars)"
          required
          type="password"
          value={password}
        />
        <button className="text-xs font-semibold underline disabled:opacity-50" disabled={busy} type="submit">
          {busy ? "Saving…" : "Issue"}
        </button>
      </div>
      {message && <span className="text-xs text-[var(--success)]" role="status">{message}</span>}
      {error && <span className="text-xs text-[var(--danger)]" role="alert">{error}</span>}
    </form>
  );
}
