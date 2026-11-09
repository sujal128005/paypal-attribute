import { EngineError } from "@/lib/engine";
import { authenticate, fail, ok } from "@/lib/http";
import { db } from "@/lib/store";
import { attributionView, publicSale } from "@/lib/views";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    await authenticate(req);
    const { token } = await ctx.params;
    const state = db();
    const att = state.attributions.find((a) => a.token === token);
    if (!att) throw new EngineError("Unknown attribution token", 404);
    const sales = state.sales.filter((s) => s.attributionToken === token);
    return ok({
      ...attributionView(att, state),
      sales: sales.map((s) => publicSale(s, state.splits.find((sp) => sp.saleId === s.id) ?? null, state.payouts.filter((p) => p.saleId === s.id))),
    });
  } catch (err) {
    return fail(err);
  }
}
