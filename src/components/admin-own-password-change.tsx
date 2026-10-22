"use client";

import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";

export function AdminOwnPasswordChange() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const values = new FormData(formElement);
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/admin-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_current",
          currentPassword: values.get("currentPassword"),
          newPassword: values.get("newPassword"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not change password.");
        return;
      }
      formElement.reset();
      setMessage(result.message ?? "Administrator password changed.");
    } catch {
      setError("Unable to change your password. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid max-w-xl gap-3" onSubmit={submit}>
      <GlassInput name="currentPassword" type="password" autoComplete="current-password" placeholder="Current password" required />
      <GlassInput name="newPassword" type="password" autoComplete="new-password" placeholder="New password (10+ characters)" minLength={10} maxLength={256} required />
      <GlassButton className="w-fit" loading={busy} type="submit">{busy ? "Updating…" : "Change password"}</GlassButton>
      {message && <p className="text-sm text-[var(--success)]" role="status">{message}</p>}
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
    </form>
  );
}
