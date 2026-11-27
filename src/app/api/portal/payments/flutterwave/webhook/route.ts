import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { GET as verifyReturn } from "../callback/route";

type FlutterwaveEvent = {
  event?: string;
  data?: { id?: number | string; tx_ref?: string; status?: string };
};

export async function POST(request: Request) {
  const expectedHash = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!expectedHash) return NextResponse.json({ error: "Webhook verification is not configured" }, { status: 503 });
  const receivedHash = request.headers.get("verif-hash") ?? "";
  const expected = Buffer.from(expectedHash);
  const received = Buffer.from(receivedHash);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let event: FlutterwaveEvent;
  try { event = await request.json() as FlutterwaveEvent; }
  catch { return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 }); }
  if (event.event !== "charge.completed" || event.data?.status !== "successful") {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const txRef = event.data.tx_ref ?? "";
  const transactionId = String(event.data.id ?? "");
  if (!/^dla_[0-9a-f-]{36}$/i.test(txRef) || !/^\d+$/.test(transactionId)) {
    return NextResponse.json({ error: "Invalid transaction details" }, { status: 400 });
  }

  // The callback handler independently verifies the transaction against
  // Flutterwave before applying the payment to fee schedules. This makes the
  // browser return and webhook idempotent and safe to receive in either order.
  const publicOrigin = process.env.APP_URL || new URL(request.url).origin;
  const verifyUrl = new URL("/api/portal/payments/flutterwave/callback", publicOrigin);
  verifyUrl.searchParams.set("tx_ref", txRef);
  verifyUrl.searchParams.set("transaction_id", transactionId);
  verifyUrl.searchParams.set("status", "successful");
  await verifyReturn(new Request(verifyUrl));
  return NextResponse.json({ ok: true });
}
