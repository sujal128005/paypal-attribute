import { z } from "zod";
import { releaseDuePayouts } from "@/lib/engine";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ saleId: z.string().optional(), force: z.boolean().default(false) });

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json().catch(() => ({})));
    return ok(await releaseDuePayouts(body));
  } catch (err) {
    return fail(err);
  }
}
