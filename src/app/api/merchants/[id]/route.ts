import { z } from "zod";
import { EngineError, log } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { mutate } from "@/lib/store";
import { usd } from "@/lib/util";

export const dynamic = "force-dynamic";

const Body = z.object({
  commissionRate: z.number().min(0.01).max(0.3).optional(),
  monthlyBudget: z.number().int().min(1000).max(100_000_000).optional(),
  minShare: z.number().min(0).max(0.3).optional(),
  maxShare: z.number().min(0.3).max(1).optional(),
  holdMinutes: z.number().int().min(0).max(60 * 24 * 60).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const patch = Body.parse(await req.json());
    const merchant = await mutate((state) => {
      const m = state.merchants.find((x) => x.id === id);
      if (!m) throw new EngineError("Unknown merchant", 404);
      Object.assign(m, patch);
      log(state, { kind: "settings", merchantId: id, message: `${m.name} updated attribution rules: ${(m.commissionRate * 100).toFixed(0)}% commission, ${usd(m.monthlyBudget)} monthly cap, ${m.holdMinutes} min hold` });
      return m;
    });
    return ok(merchant);
  } catch (err) {
    return fail(err);
  }
}
