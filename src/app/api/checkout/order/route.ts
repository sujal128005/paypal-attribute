// Step 1 of real PayPal checkout: create our sale record, then a PayPal order that carries
// the attribution token in purchase_units[].custom_id.
import { z } from "zod";
import { createSaleRecord, EngineError } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { createOrder, paypalConfigured } from "@/lib/paypal";
import { db, mutate } from "@/lib/store";
import { randomId } from "@/lib/util";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().startsWith("att_"), productId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    if (!paypalConfigured()) throw new EngineError("PayPal sandbox is not configured on this server", 503);
    const { token, productId } = Body.parse(await req.json());
    const sale = await mutate((state) => createSaleRecord(state, { attributionToken: token, productId, mode: "paypal" }));
    const merchant = db().merchants.find((m) => m.id === sale.merchantId)!;
    const order = await createOrder({
      amount: sale.amount,
      attributionToken: token,
      saleId: sale.id,
      merchantName: merchant.name,
      productTitle: sale.productTitle,
      requestId: randomId("req", 16),
    });
    await mutate((state) => {
      const s = state.sales.find((x) => x.id === sale.id)!;
      s.paypalOrderId = order.id;
    });
    return ok({ saleId: sale.id, orderId: order.id });
  } catch (err) {
    return fail(err);
  }
}
