import { NextResponse } from "next/server";

/** Existing Flutterwave payments can still be verified by the legacy callback/webhook routes,
 * but all new student checkouts go through Pesapal. */
export async function POST() {
  return NextResponse.json({ error: "Flutterwave checkout has been replaced by Pesapal. Start a new payment from your student fees page." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
