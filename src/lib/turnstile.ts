import "server-only";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing_token" | "not_configured" | "provider_unavailable" | "rejected" };

/** Cloudflare Turnstile is required in production and fails closed if its server key is missing. */
export async function verifyTurnstile(token: string | undefined): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production" ? { ok: true } : { ok: false, reason: "not_configured" };
  if (!token) return { ok: false, reason: "missing_token" };
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { ok: false, reason: "provider_unavailable" };
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (json.success === true) return { ok: true };
    console.warn("[turnstile] Token rejected by Siteverify", json["error-codes"] ?? []);
    return { ok: false, reason: "rejected" };
  } catch {
    console.error("[turnstile] Siteverify request failed");
    return { ok: false, reason: "provider_unavailable" };
  }
}
