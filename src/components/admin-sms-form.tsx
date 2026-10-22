"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GlassButton } from "@/components/ui/glass";

export function AdminSmsForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setResult("");
    try {
      const response = await fetch("/api/admin/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: new FormData(form).get("message") }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The message could not be submitted.");
        return;
      }
      setResult(`Campaign submitted to ${data.acceptedCount} eligible student accounts. Recipient numbers are not displayed or stored in campaign history.`);
      form.reset();
      router.refresh();
    } catch {
      setError("Unable to submit the campaign. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="bulk-sms-message">
        Message for active and registered students
        <textarea id="bulk-sms-message" name="message" className="glass min-h-32 w-full rounded-xl px-4 py-3 font-normal" maxLength={480} required />
      </label>
      <p className="text-xs opacity-65">Africa&apos;s Talking receives recipient numbers only to deliver the SMS. Numbers are not shown in this interface or saved in campaign records. Phone numbers and contact handles are blocked in message text.</p>
      <GlassButton type="submit" disabled={busy}>{busy ? "Submitting..." : "Send bulk SMS"}</GlassButton>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {result && <p className="text-sm text-[var(--success)]" role="status">{result}</p>}
    </form>
  );
}
