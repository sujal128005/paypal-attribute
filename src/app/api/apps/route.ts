import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { mutate } from "@/lib/store";
import { randomId } from "@/lib/util";

export const dynamic = "force-dynamic";

const Body = z.object({ name: z.string().trim().min(2).max(60) });

export async function POST(req: Request) {
  try {
    const { name } = Body.parse(await req.json());
    const app = await mutate((state) => {
      const a = { id: randomId("app", 10), name, apiKey: `pa_test_${randomId("k", 26).slice(2).toLowerCase()}`, createdAt: new Date().toISOString(), requests: 0 };
      state.apps.unshift(a);
      return a;
    });
    return ok(app, 201);
  } catch (err) {
    return fail(err);
  }
}
