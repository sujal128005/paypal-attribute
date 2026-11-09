// Step 2 of real PayPal checkout: capture, verify the token round-tripped through PayPal,
// then run attribution. The webhook path does the same work idempotently.
import { z } from "zod";
import { EngineError, processCapturedSale } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { captureOrder } from "@/lib/paypal";
import { db } from "@/lib/store";
import { randomId } from "@/lib/util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ saleId: z.string().startsWith("sale_"), orderId: z.string().min(5) });

export async function POST(req: Request) {
  try {
    const { saleId, orderId } = Body.parse(await req.json());
    const sale = db().sales.find((s) => s.id === saleId);
    if (!sale || sale.paypalOrderId !== orderId) throw new EngineError("Order does not match this sale", 400);
    const res = await captureOrder(orderId, randomId("cap", 16));
    const capture = res.purchase_units?.[0]?.payments?.captures?.[0];
    if (res.status !== "COMPLETED" || !capture) throw new EngineError(`PayPal capture status: ${res.status}`, 402);
    if (capture.custom_id && capture.custom_id !== sale.attributionToken) throw new EngineError("Attribution token mismatch on capture", 409);
    const split = await processCapturedSale(saleId, { captureId: capture.id, payerEmail: res.payer?.email_address });
    return ok({ saleId, captureId: capture.id, payer: res.payer?.email_address ?? null, split });
  } catch (err) {
    return fail(err);
  }
}
