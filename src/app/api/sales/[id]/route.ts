import { EngineError, releaseDuePayouts } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { saleDetail } from "@/lib/views";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await releaseDuePayouts({ saleId: id });
    const detail = saleDetail(id);
    if (!detail) throw new EngineError("Unknown sale", 404);
    return ok(detail);
  } catch (err) {
    return fail(err);
  }
}
