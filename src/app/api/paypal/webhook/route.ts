// PayPal webhooks: signature-verified, idempotent by event id.
//   PAYMENT.CAPTURE.COMPLETED  → run attribution (no-op if the capture route already did)
//   PAYMENT.CAPTURE.REFUNDED   → reverse held payouts / claw back sent ones
//   PAYMENT.PAYOUTS-ITEM.*     → reconcile creator payout status
import { applyRefund, log, processCapturedSale } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { verifyWebhookSignature } from "@/lib/paypal";
import { db, mutate } from "@/lib/store";

export const dynamic = "force-dynamic";

interface WebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id?: string;
    custom_id?: string;
    status?: string;
    supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
    links?: { rel: string; href: string }[];
    payout_item?: { sender_item_id?: string };
    transaction_status?: string;
  };
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const event = JSON.parse(raw) as WebhookEvent;
    if (!process.env.PAYPAL_WEBHOOK_ID) return ok({ error: "Webhook ID not configured" }, 503);
    const verified = await verifyWebhookSignature(req.headers, event);
    if (!verified) return ok({ error: "Invalid signature" }, 401);

    const fresh = await mutate((state) => {
      if (state.webhookEvents.some((e) => e.id === event.id)) return false;
      state.webhookEvents.unshift({ id: event.id, type: event.event_type, receivedAt: new Date().toISOString() });
      state.webhookEvents.length = Math.min(state.webhookEvents.length, 500);
      log(state, { kind: "webhook", message: `Webhook ${event.event_type} (${event.id}) verified` });
      return true;
    });
    if (!fresh) return ok({ received: true, duplicate: true });

    const r = event.resource;
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = r.supplementary_data?.related_ids?.order_id;
      const sale = db().sales.find((s) => (orderId && s.paypalOrderId === orderId) || s.paypalCaptureId === r.id || (r.custom_id && s.attributionToken === r.custom_id && s.status === "created"));
      if (sale) await processCapturedSale(sale.id, { captureId: r.id });
    } else if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
      const captureId = r.links?.find((l) => l.rel === "up")?.href.split("/").pop() ?? r.supplementary_data?.related_ids?.capture_id;
      const sale = db().sales.find((s) => s.paypalCaptureId && s.paypalCaptureId === captureId);
      if (sale && sale.status === "captured") await mutate((state) => applyRefund(state, sale.id));
    } else if (event.event_type.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
      const payoutId = r.payout_item?.sender_item_id;
      await mutate((state) => {
        const p = state.payouts.find((x) => x.id === payoutId);
        if (!p) return;
        p.itemId = r.id ?? p.itemId;
        const status = event.event_type.replace("PAYMENT.PAYOUTS-ITEM.", "");
        if (["FAILED", "RETURNED", "BLOCKED", "DENIED", "REFUNDED"].includes(status)) {
          p.status = "failed";
          p.note = `PayPal reported ${status.toLowerCase()}`;
        } else if (status === "UNCLAIMED") {
          p.note = "Unclaimed: creator has not accepted the payment yet";
        } else if (status === "SUCCEEDED") {
          p.note = "Delivered to the creator's PayPal balance";
        }
      });
    }
    return ok({ received: true });
  } catch (err) {
    return fail(err);
  }
}
