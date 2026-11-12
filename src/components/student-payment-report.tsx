"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassButton, GlassInput } from "@/components/ui/glass";

export function StudentPaymentReport({ currencies }: { currencies: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/finance/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(form.get("amount")), currency: form.get("currency"), method: form.get("method"), reference: form.get("reference") }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Payment could not be submitted."); return; }
      formElement.reset();
      setMessage("Payment details submitted. Finance will verify the transfer before your balance changes.");
      router.refresh();
    } catch { setError("Could not reach the payment service. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
      <label className="grid gap-1 text-sm">Amount paid<GlassInput name="amount" type="number" min={1} step={1} required /></label>
      <label className="grid gap-1 text-sm">Currency<select className="glass rounded-xl px-3 py-2.5" name="currency" required>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Payment method<select className="glass rounded-xl px-3 py-2.5" name="method" required><option value="bank">Bank transfer</option><option value="momo">MTN Mobile Money</option><option value="airtel_money">Airtel Money</option><option value="cash">Cash at school</option><option value="other">Other</option></select></label>
      <label className="grid gap-1 text-sm">Transaction/reference number<GlassInput name="reference" minLength={2} maxLength={160} required /></label>
      <div className="sm:col-span-2"><GlassButton type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit payment for verification"}</GlassButton></div>
      {message && <p role="status" className="text-sm text-emerald-700 sm:col-span-2">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
    </form>
  );
}
