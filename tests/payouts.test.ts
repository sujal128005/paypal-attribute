import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attr-payouts-"));

beforeAll(() => {
  process.env.DATA_DIR = dir;
  process.env.PAYPAL_CLIENT_ID = "test-client";
  process.env.PAYPAL_CLIENT_SECRET = "test-secret";
});
afterAll(() => vi.unstubAllGlobals());

async function paypalSale() {
  const { mutate } = await import("@/lib/store");
  const { createAttributionRecord, createSaleRecord, applySplit } = await import("@/lib/engine");
  const { scoreWithRules } = await import("@/lib/scoring");
  return mutate((state) => {
    const src = state.sources.find((s) => s.id === "src_maya_aura_review")!;
    const att = createAttributionRecord(state, {
      appId: "app_demo", channel: "api", query: "headphones", answer: "x", productIds: ["p_aura_one"],
      citations: [{ n: 1, sourceId: src.id, creatorId: src.creatorId, claim: "", productIds: ["p_aura_one"] }], engine: "rules",
    });
    const sale = createSaleRecord(state, { attributionToken: att.token, productId: "p_aura_one", mode: "paypal", buyerEmail: "buyer@example.com" });
    sale.status = "captured";
    sale.capturedAt = new Date().toISOString();
    const product = state.products.find((p) => p.id === "p_aura_one")!;
    applySplit(state, sale.id, scoreWithRules({ attribution: att, purchased: product, sources: state.sources, creators: state.creators }), "rules");
    return sale.id;
  });
}

function stubPayPal(payoutStatus: number, payoutBody: unknown) {
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/v1/oauth2/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
    if (url.endsWith("/v1/payments/payouts")) return new Response(JSON.stringify(payoutBody), { status: payoutStatus });
    throw new Error(`unexpected fetch ${url}`);
  });
}

describe("PayPal Payouts failures", () => {
  it("settles in a labelled simulated batch when the account can never send payouts", async () => {
    stubPayPal(422, { name: "UNPROCESSABLE_ENTITY", message: "You live in a country that is not allowed to send this payout." });
    const saleId = await paypalSale();
    const { releaseDuePayouts } = await import("@/lib/engine");
    const { db } = await import("@/lib/store");
    await releaseDuePayouts({ saleId, force: true });
    const payouts = db().payouts.filter((p) => p.saleId === saleId);
    expect(payouts.length).toBeGreaterThan(0);
    for (const p of payouts) {
      expect(p.status).toBe("sent");
      expect(p.mode).toBe("simulated");
      expect(p.note).toMatch(/Payouts is not available/);
    }
  });

  it("keeps payouts on hold and retries on a temporary PayPal outage", async () => {
    stubPayPal(503, { message: "Service unavailable" });
    const saleId = await paypalSale();
    const { releaseDuePayouts } = await import("@/lib/engine");
    const { db } = await import("@/lib/store");
    await releaseDuePayouts({ saleId, force: true });
    for (const p of db().payouts.filter((x) => x.saleId === saleId)) {
      expect(p.status).toBe("held");
      expect(p.note).toMatch(/will retry/);
    }
  });
});
