// Demo checkout for environments without PayPal sandbox keys. Runs the exact same
// attribution, risk, split and payout code; only the payment step is simulated.
import { z } from "zod";
import { createSaleRecord, processCapturedSale } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { mutate } from "@/lib/store";
import { randomId } from "@/lib/util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  token: z.string().startsWith("att_"),
  productId: z.string().min(1),
  buyerEmail: z.string().email().optional(),
});

export async function POST(req: Request) {
  try {
    const { token, productId, buyerEmail } = Body.parse(await req.json());
    const sale = await mutate((state) => {
      const s = createSaleRecord(state, { attributionToken: token, productId, mode: "simulated", buyerEmail: buyerEmail ?? "shopper@personal.example.com" });
      s.paypalOrderId = `SIM-ORDER-${randomId("x", 10).slice(2)}`;
      return s;
    });
    const split = await processCapturedSale(sale.id, { captureId: `SIM-CAP-${randomId("x", 10).slice(2)}` });
    return ok({ saleId: sale.id, split });
  } catch (err) {
    return fail(err);
  }
}
