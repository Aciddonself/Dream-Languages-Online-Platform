import "server-only";

type PesapalTokenResponse = { token?: string; status?: string; error?: unknown };
type PesapalOrderResponse = { redirect_url?: string; order_tracking_id?: string; error?: unknown };
export type PesapalTransactionStatus = {
  merchant_reference?: string;
  payment_status_description?: string;
  status_code?: number | string;
  amount?: number | string;
  currency?: string;
  confirmation_code?: string;
  payment_method?: string;
};

export function pesapalConfigured() {
  return Boolean(process.env.PESAPAL_CONSUMER_KEY && process.env.PESAPAL_CONSUMER_SECRET && process.env.PESAPAL_IPN_ID);
}

function baseUrl() {
  return process.env.PESAPAL_ENVIRONMENT?.toLowerCase() === "live"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3";
}

async function token() {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) throw new Error("PESAPAL_NOT_CONFIGURED");
  const response = await fetch(`${baseUrl()}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({})) as PesapalTokenResponse;
  if (!response.ok || !data.token) throw new Error("PESAPAL_AUTH_FAILED");
  return data.token;
}

export async function createPesapalOrder(input: {
  reference: string;
  amount: number;
  origin: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
}) {
  const notificationId = process.env.PESAPAL_IPN_ID;
  if (!notificationId) throw new Error("PESAPAL_NOT_CONFIGURED");
  const accessToken = await token();
  const url = new URL(`${baseUrl()}/api/Transactions/SubmitOrderRequest`);
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      id: input.reference,
      currency: "UGX",
      amount: input.amount,
      description: "Dream Languages Uganda student fees",
      callback_url: `${input.origin}/api/portal/payments/pesapal/callback`,
      cancellation_url: `${input.origin}/student/fees?payment=cancelled`,
      redirect_mode: "TOP_WINDOW",
      notification_id: notificationId,
      billing_address: {
        email_address: input.email,
        phone_number: input.phone || "",
        country_code: "UG",
        first_name: input.firstName || "DLA",
        middle_name: "",
        last_name: input.lastName || "Student",
        line_1: "",
        line_2: "",
        city: "",
        state: "",
        postal_code: "",
        zip_code: "",
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => ({})) as PesapalOrderResponse;
  const redirectUrl = data.redirect_url;
  if (!response.ok || !redirectUrl) throw new Error("PESAPAL_ORDER_FAILED");
  const parsedUrl = new URL(redirectUrl);
  if (parsedUrl.origin !== new URL(baseUrl()).origin || !parsedUrl.pathname.startsWith("/")) throw new Error("PESAPAL_INVALID_CHECKOUT_URL");
  return { redirectUrl, trackingId: data.order_tracking_id ?? null };
}

export async function getPesapalTransactionStatus(orderTrackingId: string) {
  const accessToken = await token();
  const url = new URL(`${baseUrl()}/api/Transactions/GetTransactionStatus`);
  url.searchParams.set("orderTrackingId", orderTrackingId);
  const response = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({})) as PesapalTransactionStatus;
  if (!response.ok) throw new Error("PESAPAL_STATUS_UNAVAILABLE");
  return data;
}

export async function registerPesapalIpn(notificationUrl: string) {
  const accessToken = await token();
  const response = await fetch(`${baseUrl()}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ url: notificationUrl, ipn_notification_type: "GET" }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({})) as { ipn_id?: string; error?: unknown };
  if (!response.ok || !data.ipn_id) throw new Error("PESAPAL_IPN_REGISTRATION_FAILED");
  return data.ipn_id;
}
