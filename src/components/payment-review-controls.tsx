"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PaymentReviewControls({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(action: "verify" | "reject") {
    const reason = action === "reject" ? window.prompt("Reason for rejecting this payment:")?.trim() : undefined;
    if (action === "reject" && !reason) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/finance/payments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId, action, reason }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Payment review failed."); return; }
      router.refresh();
    } catch { setError("Could not reach the payment service."); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap gap-2">
    <button type="button" disabled={busy} onClick={() => void decide("verify")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Verify</button>
    <button type="button" disabled={busy} onClick={() => void decide("reject")} className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Reject</button>
    {error && <span role="alert" className="basis-full text-xs text-red-700">{error}</span>}
  </div>;
}
