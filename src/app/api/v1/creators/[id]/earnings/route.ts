import { EngineError } from "@/lib/engine";
import { authenticate, fail, ok } from "@/lib/http";
import { db } from "@/lib/store";
import { creatorEarnings } from "@/lib/views";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await authenticate(req);
    const { id } = await ctx.params;
    const c = db().creators.find((x) => x.id === id);
    if (!c) throw new EngineError("Unknown creator", 404);
    const e = creatorEarnings(id);
    return ok({
      creator: { id: c.id, name: c.name, handle: c.handle, paypal_connected: c.paypalConnected },
      currency: "USD",
      paid: e.paid / 100,
      pending: e.pending / 100,
      reversed: e.reversed / 100,
      clawback_outstanding: e.clawbackOutstanding / 100,
      citations: e.citations,
      attributed_sales: e.sales,
    });
  } catch (err) {
    return fail(err);
  }
}
