import { z } from "zod";
import { EngineError, log } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";

const Body = z.object({ action: z.enum(["approve", "confirm", "dismiss"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { action } = Body.parse(await req.json());
    const flag = await mutate((state) => {
      const f = state.risk.find((x) => x.id === id);
      if (!f) throw new EngineError("Unknown risk flag", 404);
      f.status = action === "confirm" ? "confirmed" : "dismissed";
      if (f.saleId && action !== "confirm") {
        // Clearing the last open flag on a held sale approves its payouts.
        const open = state.risk.filter((x) => x.saleId === f.saleId && x.status === "open");
        const split = state.splits.find((s) => s.saleId === f.saleId);
        if (split && !open.length && split.risk.decision === "review") {
          split.risk.decision = "approved";
          for (const p of state.payouts.filter((x) => x.saleId === f.saleId && x.status === "held")) p.note = "Approved after review: releases with the next batch";
        }
      }
      if (f.saleId && action === "confirm") {
        // Confirmed fraud: cancel everything this sale would still pay.
        const split = state.splits.find((s) => s.saleId === f.saleId);
        if (split) split.risk.decision = "blocked";
        for (const p of state.payouts.filter((x) => x.saleId === f.saleId && (x.status === "held" || x.status === "released"))) {
          p.status = "reversed";
          p.note = "Cancelled: fraud confirmed by reviewer";
          state.ledger.push({ id: `led_${p.id}_fraud`, ts: new Date().toISOString(), type: "payout_reversed", amount: -p.amount, creatorId: p.creatorId, payoutId: p.id, saleId: p.saleId, memo: "Fraud confirmed: earning cancelled" });
        }
      }
      if (f.sourceId) {
        const s = state.sources.find((x) => x.id === f.sourceId);
        if (s) s.status = action === "confirm" ? "blocked" : "active";
      }
      log(state, { kind: "risk", saleId: f.saleId, message: `Risk flag ${f.kind.replace(/_/g, " ")} ${action === "confirm" ? "confirmed" : action === "approve" ? "approved" : "dismissed"} by reviewer` });
      return f;
    });
    return ok(flag);
  } catch (err) {
    return fail(err);
  }
}
