"use client";

import { useState } from "react";

type ApiResult = { ok?: boolean; ipnId?: string; environment?: string; error?: string };

export function PesapalIpnSetup() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  async function register() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/payments/pesapal/register-ipn", { method: "POST", cache: "no-store" });
      const data = await response.json().catch(() => ({})) as ApiResult;
      if (!response.ok) throw new Error(data.error || "Could not register Pesapal notifications.");
      setResult(data);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Could not register Pesapal notifications." });
    } finally {
      setBusy(false);
    }
  }
  return <div>
    <button type="button" className="btn-glass btn-glass-primary rounded-xl px-4 py-2 font-semibold" onClick={() => void register()} disabled={busy}>
      {busy ? "Registering…" : "Register Pesapal notification URL"}
    </button>
    {result?.ipnId && <p className="mt-3 break-all text-sm" role="status">Registered for {result.environment}. Add this ID to Railway as <strong>PESAPAL_IPN_ID</strong>: <code>{result.ipnId}</code></p>}
    {result?.error && <p className="mt-3 text-sm text-red-700" role="alert">{result.error}</p>}
  </div>;
}
