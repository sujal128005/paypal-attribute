import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({ ok: true, time: new Date().toISOString() });
}
