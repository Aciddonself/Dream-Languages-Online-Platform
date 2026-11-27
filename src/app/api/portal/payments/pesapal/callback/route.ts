import { NextResponse } from "next/server";
import { settlePesapalPayment } from "@/lib/pesapal-payment-settlement";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const trackingId = url.searchParams.get("OrderTrackingId") ?? "";
  const reference = url.searchParams.get("OrderMerchantReference") ?? "";
  const returnTo = (result: string) => NextResponse.redirect(new URL(`/student/fees?payment=${result}`, process.env.APP_URL || url.origin), 303);
  if (!trackingId || trackingId.length > 100 || !/^DLA-[0-9a-f-]{36}$/i.test(reference)) return returnTo("invalid");
  try {
    return returnTo(await settlePesapalPayment(reference, trackingId));
  } catch (error) {
    console.error("Pesapal callback could not reconcile payment", error instanceof Error ? error.message : "unknown error");
    return returnTo("verification-pending");
  }
}
