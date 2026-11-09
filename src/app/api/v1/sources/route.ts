// GET  /v1/sources — agents look up registered creator content to cite.
// POST /v1/sources — platforms register creator content (screened before it can earn).
import { z } from "zod";
import { registerSource } from "@/lib/engine";
import { authenticate, fail, ok } from "@/lib/http";
import { db } from "@/lib/store";
import { tokenize } from "@/lib/util";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await authenticate(req);
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const productId = url.searchParams.get("product_id");
    const terms = new Set(tokenize(q));
    const state = db();
    const data = state.sources
      .filter((s) => s.status === "active")
      .filter((s) => !productId || s.productIds.includes(productId))
      .map((s) => ({ s, score: s.keywords.filter((k) => terms.has(k)).length + tokenize(s.title).filter((t) => terms.has(t)).length }))
      .filter((x) => !q || x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(({ s }) => {
        const c = state.creators.find((x) => x.id === s.creatorId)!;
        return { id: s.id, title: s.title, url: s.url, kind: s.kind, excerpt: s.excerpt, product_ids: s.productIds, creator: { id: c.id, name: c.name, handle: c.handle } };
      });
    return ok({ data });
  } catch (err) {
    return fail(err);
  }
}

const Body = z.object({
  creator_id: z.string(),
  title: z.string().trim().min(5).max(140),
  url: z.string().url(),
  kind: z.enum(["review", "video", "guide", "comparison", "podcast"]),
  excerpt: z.string().trim().min(20).max(1200),
  categories: z.array(z.enum(["audio", "running", "coffee", "camera", "home", "travel"])).min(1),
  product_ids: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  try {
    await authenticate(req);
    const b = Body.parse(await req.json());
    const src = await registerSource({ creatorId: b.creator_id, title: b.title, url: b.url, kind: b.kind, excerpt: b.excerpt, categories: b.categories, productIds: b.product_ids });
    return ok({ id: src.id, status: src.status, screening: src.screening }, 201);
  } catch (err) {
    return fail(err);
  }
}
