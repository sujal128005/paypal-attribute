// Thin, typed client for the PayPal REST APIs used by PayPal Attribute (sandbox by default).
//   Orders v2   – create / capture checkout orders, attribution token in purchase_units[].custom_id
//   Payments v2 – refund captures (drives clawbacks)
//   Payouts v1  – batch payouts to creators
//   Webhooks v1 – signature verification
//   Identity    – Log in with PayPal for creator onboarding
import type { Cents } from "./types";

const ENV = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
export const PAYPAL_API = ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
export const PAYPAL_WEB = ENV === "live" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";

export const paypalConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
export const paypalClientId = () => process.env.PAYPAL_CLIENT_ID ?? "";
/** Log in with PayPal must be enabled on the PayPal app (Other features → Log in with PayPal), so it is opt-in. */
export const loginWithPayPalEnabled = () => paypalConfigured() && process.env.PAYPAL_LOGIN_ENABLED === "true";

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public debugId?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let cached: { token: string; expires: number } | undefined;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new PayPalError(`PayPal auth failed (${res.status})`, res.status);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function call<T>(method: string, pathname: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${PAYPAL_API}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new PayPalError(json?.message || json?.error_description || `PayPal ${method} ${pathname} failed`, res.status, json?.debug_id, json?.details);
  }
  return json as T;
}

const money = (cents: Cents) => (cents / 100).toFixed(2);

export interface OrderResult {
  id: string;
  status: string;
}

export function createOrder(input: {
  amount: Cents;
  attributionToken: string;
  saleId: string;
  merchantName: string;
  productTitle: string;
  requestId: string;
}) {
  return call<OrderResult>(
    "POST",
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.saleId,
          custom_id: input.attributionToken, // ← the attribution token rides with the payment
          description: `${input.productTitle} · AI-attributed purchase`,
          soft_descriptor: "ATTRIBUTE",
          amount: {
            currency_code: "USD",
            value: money(input.amount),
            breakdown: { item_total: { currency_code: "USD", value: money(input.amount) } },
          },
          items: [{ name: input.productTitle.slice(0, 127), quantity: "1", category: "PHYSICAL_GOODS", unit_amount: { currency_code: "USD", value: money(input.amount) } }],
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: input.merchantName.slice(0, 127),
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
          },
        },
      },
    },
    { "PayPal-Request-Id": input.requestId },
  );
}

export interface CaptureResult {
  id: string;
  status: string;
  payer?: { email_address?: string; payer_id?: string; name?: { given_name?: string; surname?: string } };
  purchase_units: {
    reference_id?: string;
    payments?: { captures?: { id: string; status: string; custom_id?: string; amount: { value: string; currency_code: string } }[] };
  }[];
}

export function captureOrder(orderId: string, requestId: string) {
  return call<CaptureResult>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, { "PayPal-Request-Id": requestId });
}

export function refundCapture(captureId: string, requestId: string) {
  return call<{ id: string; status: string }>("POST", `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {}, { "PayPal-Request-Id": requestId });
}

export interface PayoutBatchResult {
  batch_header: { payout_batch_id: string; batch_status: string; sender_batch_header: { sender_batch_id: string } };
}

export function createPayoutBatch(input: {
  senderBatchId: string;
  items: { payoutId: string; email: string; amount: Cents; note: string }[];
}) {
  return call<PayoutBatchResult>("POST", "/v1/payments/payouts", {
    sender_batch_header: {
      sender_batch_id: input.senderBatchId,
      email_subject: "You earned from an AI recommendation",
      email_message: "An AI shopping agent cited your content in a purchase. Here's your share, via PayPal Attribute.",
    },
    items: input.items.map((i) => ({
      recipient_type: "EMAIL",
      receiver: i.email,
      amount: { value: money(i.amount), currency: "USD" },
      note: i.note.slice(0, 4000),
      sender_item_id: i.payoutId,
    })),
  });
}

export function getPayoutBatch(batchId: string) {
  return call<{ batch_header: { batch_status: string }; items?: { payout_item_id: string; transaction_status: string; payout_item: { sender_item_id: string } }[] }>(
    "GET",
    `/v1/payments/payouts/${encodeURIComponent(batchId)}`,
  );
}

export async function verifyWebhookSignature(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const res = await call<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: event,
  });
  return res.verification_status === "SUCCESS";
}

// ─── Log in with PayPal (creator onboarding) ─────────────────────────────────
export function loginWithPayPalUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    flowEntry: "static",
    client_id: paypalClientId(),
    response_type: "code",
    scope: "openid email https://uri.paypal.com/services/paypalattributes",
    redirect_uri: redirectUri,
    state,
  });
  return `${PAYPAL_WEB}/signin/authorize?${params}`;
}

export async function exchangeLoginCode(code: string): Promise<{ email?: string; payerId?: string; name?: string }> {
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code }).toString(),
    cache: "no-store",
  });
  if (!tokenRes.ok) throw new PayPalError("Log in with PayPal code exchange failed", tokenRes.status);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const infoRes = await fetch(`${PAYPAL_API}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
    headers: { Authorization: `Bearer ${access_token}` },
    cache: "no-store",
  });
  if (!infoRes.ok) throw new PayPalError("Could not read PayPal profile", infoRes.status);
  const info = (await infoRes.json()) as { payer_id?: string; name?: string; emails?: { value: string; primary?: boolean }[] };
  const email = info.emails?.find((e) => e.primary)?.value ?? info.emails?.[0]?.value;
  return { email, payerId: info.payer_id, name: info.name };
}
