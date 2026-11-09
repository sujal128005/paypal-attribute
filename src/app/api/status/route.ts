import { aiConfigured, aiLabel, providers } from "@/lib/ai";
import { channel3Configured } from "@/lib/channel3";
import { ok } from "@/lib/http";
import { paypalClientId, paypalConfigured } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({
    paypal: { configured: paypalConfigured(), env: process.env.PAYPAL_ENV ?? "sandbox", client_id: paypalConfigured() ? paypalClientId() : null, webhooks: Boolean(process.env.PAYPAL_WEBHOOK_ID) },
    ai: { configured: aiConfigured(), chain: [...providers().map((p) => `${p.name} (${p.model})`), "built-in rules"], label: aiLabel() },
    channel3: { configured: channel3Configured() },
  });
}
