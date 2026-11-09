import { applyRefund, EngineError } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { paypalConfigured, refundCapture } from "@/lib/paypal";
import { db, mutate } from "@/lib/store";
import { randomId } from "@/lib/util";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sale = db().sales.find((s) => s.id === id);
    if (!sale) throw new EngineError("Unknown sale", 404);
    let paypalRefundId: string | undefined;
    if (sale.mode === "paypal" && sale.paypalCaptureId && paypalConfigured()) {
      const r = await refundCapture(sale.paypalCaptureId, randomId("ref", 16));
      paypalRefundId = r.id;
    }
    await mutate((state) => applyRefund(state, id));
    return ok({ saleId: id, refunded: true, paypalRefundId: paypalRefundId ?? null });
  } catch (err) {
    return fail(err);
  }
}
