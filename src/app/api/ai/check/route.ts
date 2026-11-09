// Diagnostic: pings each configured AI provider with a tiny request and reports the result.
// Never returns keys. Useful when the app silently falls back to the built-in rules.
import { activeModel, complete, providers } from "@/lib/ai";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const list = providers();
  const results = await Promise.all(
    list.map(async (p) => {
      const started = Date.now();
      try {
        const text = await complete(p, "You are a health check. Reply with the single word OK.", "ping", false);
        return { provider: p.name, model: activeModel(p), configured_model: p.model, ok: true, ms: Date.now() - started, reply: text.slice(0, 40) };
      } catch (err) {
        return { provider: p.name, model: activeModel(p), configured_model: p.model, ok: false, ms: Date.now() - started, error: (err as Error).message.slice(0, 400) };
      }
    }),
  );
  return ok({ configured: list.map((p) => p.name), results, fallback: "built-in rules" });
}
