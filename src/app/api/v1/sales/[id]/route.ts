import { EngineError } from "@/lib/engine";
import { authenticate, fail, ok } from "@/lib/http";
import { db } from "@/lib/store";
import { publicSale } from "@/lib/views";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await authenticate(req);
    const { id } = await ctx.params;
    const state = db();
    const sale = state.sales.find((s) => s.id === id);
    if (!sale) throw new EngineError("Unknown sale", 404);
    return ok(publicSale(sale, state.splits.find((s) => s.saleId === id) ?? null, state.payouts.filter((p) => p.saleId === id)));
  } catch (err) {
    return fail(err);
  }
}
