import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { registerPesapalIpn } from "@/lib/pesapal";

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor || !["super_admin", "admin"].includes(actor.role)) return NextResponse.json({ error: "Administrator access is required" }, { status: 403 });
  const configuredOrigin = process.env.APP_URL;
  if (!configuredOrigin) return NextResponse.json({ error: "APP_URL must be set to the public LMS origin first" }, { status: 503 });
  try {
    const ipnId = await registerPesapalIpn(new URL("/api/portal/payments/pesapal/ipn", configuredOrigin).toString());
    return NextResponse.json({ ok: true, ipnId, environment: process.env.PESAPAL_ENVIRONMENT?.toLowerCase() === "live" ? "live" : "sandbox" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Pesapal IPN registration failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Pesapal could not register the LMS payment notification address. Check the merchant credentials and try again." }, { status: 502 });
  }
}
