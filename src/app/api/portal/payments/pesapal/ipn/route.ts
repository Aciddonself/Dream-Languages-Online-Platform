import { NextResponse } from "next/server";
import { settlePesapalPayment } from "@/lib/pesapal-payment-settlement";

type PesapalNotification = {
  OrderNotificationType?: string;
  OrderTrackingId?: string;
  OrderMerchantReference?: string;
};

function ack(trackingId: string, reference: string, status: number) {
  return NextResponse.json({
    orderNotificationType: "IPNCHANGE",
    orderTrackingId: trackingId,
    orderMerchantReference: reference,
    status,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const trackingId = url.searchParams.get("OrderTrackingId") ?? "";
  const reference = url.searchParams.get("OrderMerchantReference") ?? "";
  return processNotification({ OrderNotificationType: url.searchParams.get("OrderNotificationType") ?? "", OrderTrackingId: trackingId, OrderMerchantReference: reference });
}

export async function POST(request: Request) {
  let body: PesapalNotification;
  try { body = await request.json() as PesapalNotification; }
  catch { return ack("", "", 500); }
  return processNotification(body);
}

async function processNotification(notification: PesapalNotification) {
  const trackingId = notification.OrderTrackingId ?? "";
  const reference = notification.OrderMerchantReference ?? "";
  if (notification.OrderNotificationType !== "IPNCHANGE" || !trackingId || trackingId.length > 100 || !/^DLA-[0-9a-f-]{36}$/i.test(reference)) {
    return ack(trackingId, reference, 500);
  }
  try {
    const result = await settlePesapalPayment(reference, trackingId);
    return ack(trackingId, reference, result === "not-found" ? 500 : 200);
  } catch (error) {
    console.error("Pesapal IPN could not reconcile payment", error instanceof Error ? error.message : "unknown error");
    return ack(trackingId, reference, 500);
  }
}
