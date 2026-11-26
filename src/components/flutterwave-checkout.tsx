"use client";

import { useState } from "react";

export function FlutterwaveCheckout({ outstandingUgx, configured }: { outstandingUgx: number; configured: boolean }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/portal/payments/flutterwave/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(amount) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start online checkout.");
      if (typeof data.checkoutUrl !== "string" || !data.checkoutUrl.startsWith("https://checkout.flutterwave.com/")) throw new Error("The payment service returned an invalid checkout address.");
      window.location.assign(data.checkoutUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start online checkout."); setBusy(false); }
  }
  if (outstandingUgx <= 0) return null;
  return <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white/45 p-4">
    <h3 className="font-semibold">Pay online with Visa or mobile money</h3>
    <p className="mt-1 text-sm opacity-70">Flutterwave checkout supports card and Uganda mobile money options, including the networks enabled on the school merchant account. The payment is verified on the server before your fee balance changes.</p>
    {!configured && <p className="mt-2 text-sm text-amber-800">Online checkout is awaiting the school&apos;s Flutterwave merchant credentials. You can still pay by bank transfer or mobile money using the instructions above and report your reference for Finance review.</p>}
    <form onSubmit={checkout} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm">Amount in UGX<input className="glass rounded-xl px-3 py-2.5" type="number" min={1} max={outstandingUgx} step={1} required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <button className="btn-glass btn-glass-primary px-4 py-2.5 font-semibold" disabled={busy || !configured}>{busy ? "Opening checkout…" : configured ? "Continue to secure checkout" : "Online checkout not configured"}</button>
    </form>
    {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
  </div>;
}
