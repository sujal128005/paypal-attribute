import { z } from "zod";
import { registerSource } from "@/lib/engine";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  title: z.string().trim().min(5).max(140),
  url: z.string().url(),
  kind: z.enum(["review", "video", "guide", "comparison", "podcast"]),
  excerpt: z.string().trim().min(20).max(1200),
  categories: z.array(z.enum(["audio", "running", "coffee", "camera", "home", "travel"])).min(1),
  productIds: z.array(z.string()).default([]),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    return ok(await registerSource({ creatorId: id, ...body }), 201);
  } catch (err) {
    return fail(err);
  }
}
