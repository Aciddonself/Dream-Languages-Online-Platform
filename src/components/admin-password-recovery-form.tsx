"use client";

import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";

export function AdminPasswordRecoveryForm({ token }: { token?: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    setError("");
    setBusy(true);
    const form = new FormData(formElement);
    const payload = token
      ? { action: "complete", token, password: form.get("password") }
      : { action: "request", identifier: form.get("identifier") };
    try {
      const response = await fetch("/api/auth/admin-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Password recovery failed.");
        return;
      }
      setMessage(result.message ?? "Password recovery request received.");
      formElement.reset();
    } catch {
      setError("Unable to reach the recovery service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {token ? (
        <GlassInput name="password" type="password" autoComplete="new-password" placeholder="New password (10+ characters)" minLength={10} maxLength={256} required />
      ) : (
        <GlassInput name="identifier" type="text" autoComplete="username" placeholder="Administrator email or login name" maxLength={255} required />
      )}
      <GlassButton className="w-full" loading={busy} type="submit">
        {busy ? "Please wait…" : token ? "Set new administrator password" : "Send administrator reset link"}
      </GlassButton>
      {message && <p className="text-sm text-[var(--success)]" role="status">{message}</p>}
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
    </form>
  );
}
