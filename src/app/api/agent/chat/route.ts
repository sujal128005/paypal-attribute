import { z } from "zod";
import { runShoppingAgent } from "@/lib/agent";
import { createAttributionRecord } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { db, mutate } from "@/lib/store";
import { footnotes } from "@/lib/views";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  message: z.string().trim().min(2).max(500),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(12).default([]),
});

export async function POST(req: Request) {
  try {
    const { message, history } = Body.parse(await req.json());
    const result = await runShoppingAgent(message, history);
    const att = await mutate((state) =>
      createAttributionRecord(state, {
        appId: "app_demo",
        channel: "shop-demo",
        query: message,
        answer: result.answer,
        productIds: result.productIds,
        citations: result.citations.map((c, i) => ({ ...c, n: i + 1 })),
        engine: result.engine,
        provider: result.provider,
      }),
    );
    const state = db();
    return ok({
      token: att.token,
      engine: result.engine,
      provider: result.provider ?? null,
      answer: result.answer,
      expires_at: att.expiresAt,
      footnotes: footnotes(att, state),
      products: result.products.map((p) => ({ ...p, merchant: state.merchants.find((m) => m.id === p.merchantId)?.name ?? "Merchant", commissionRate: state.merchants.find((m) => m.id === p.merchantId)?.commissionRate ?? 0 })),
    });
  } catch (err) {
    return fail(err);
  }
}
