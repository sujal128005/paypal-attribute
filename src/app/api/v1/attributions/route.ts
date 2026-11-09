// POST /v1/attributions — an AI agent registers the sources behind a recommendation and
// receives an attribution token to pass into PayPal checkout.
import { z } from "zod";
import { createAttributionRecord, EngineError } from "@/lib/engine";
import { authenticate, fail, ok } from "@/lib/http";
import { db, mutate } from "@/lib/store";
import { attributionView } from "@/lib/views";

export const dynamic = "force-dynamic";

const Body = z.object({
  query: z.string().trim().min(2).max(1000),
  answer: z.string().max(8000).default(""),
  product_ids: z.array(z.string()).min(1).max(10),
  citations: z
    .array(
      z.object({
        source_id: z.string().optional(),
        source_url: z.string().url().optional(),
        claim: z.string().max(500).default(""),
        product_ids: z.array(z.string()).default([]),
      }),
    )
    .min(1)
    .max(12),
  channel: z.enum(["api", "mcp"]).default("api"),
});

export async function POST(req: Request) {
  try {
    const app = await authenticate(req);
    const body = Body.parse(await req.json());
    const state = db();
    const warnings: string[] = [];
    const unknownProducts = body.product_ids.filter((id) => !state.products.some((p) => p.id === id));
    if (unknownProducts.length) throw new EngineError(`Unknown product_ids: ${unknownProducts.join(", ")}`, 400);

    const citations = body.citations
      .map((c, i) => {
        const src = state.sources.find((s) => (c.source_id && s.id === c.source_id) || (c.source_url && s.url === c.source_url));
        if (!src) {
          warnings.push(`citations[${i}]: source not registered with PayPal Attribute — it will not earn`);
          return null;
        }
        if (src.status === "blocked") warnings.push(`citations[${i}]: source ${src.id} is blocked by content screening and will not earn`);
        return { sourceId: src.id, creatorId: src.creatorId, claim: c.claim, productIds: c.product_ids.length ? c.product_ids : src.productIds.filter((p) => body.product_ids.includes(p)) };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c, i) => ({ ...c, n: i + 1 }));

    const att = await mutate((s) =>
      createAttributionRecord(s, { appId: app.id, channel: body.channel, query: body.query, answer: body.answer, productIds: body.product_ids, citations, engine: "rules" }),
    );
    return ok({ ...attributionView(att), warnings }, 201);
  } catch (err) {
    return fail(err);
  }
}

export async function GET(req: Request) {
  try {
    const app = await authenticate(req);
    const list = db().attributions.filter((a) => a.appId === app.id).slice(0, 25);
    return ok({ data: list.map((a) => attributionView(a)) });
  } catch (err) {
    return fail(err);
  }
}
