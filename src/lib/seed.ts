// Builds a realistic 30-day history by running the real engine over simulated traffic,
// so every number on every dashboard is produced by the same code paths a live sale uses.
import { CREATORS, MERCHANTS, PRODUCTS, SOURCES } from "./catalog";
import { applyRefund, applySplit, createAttributionRecord, createSaleRecord, log } from "./engine";
import { scoreWithRules, screenWithRules } from "./scoring";
import type { Category, Citation, Database, Source } from "./types";
import { rng, usd } from "./util";

export const SEED_VERSION = 10;
export const DEMO_API_KEY = "pa_test_demo_7kq2vx9mn4pr8st1wz";

const QUERIES: Record<Category, string[]> = {
  audio: ["noise cancelling headphones for my commute", "best headphones under $150", "earbuds that stay in at the gym", "cheap headphones for a student"],
  running: ["first pair of running shoes", "cushioned shoes for marathon training", "trail running shoes for muddy routes", "one running shoe for everything"],
  coffee: ["how do I start making pour-over coffee", "best coffee grinder for a beginner", "espresso machine for a small kitchen"],
  camera: ["beginner mirrorless camera for travel", "vlogging camera kit under $600", "lens for street photography"],
  home: ["quiet air purifier for a bedroom", "robot vacuum for cat hair", "gift under $60 for someone who has everything"],
  travel: ["carry-on that fits every airline", "daypack for city trips", "how to pack for 3 weeks in one bag"],
};

export function buildSeed(): Database {
  const r = rng(20261109);
  const t0 = Date.now();
  const at = (minutesAgo: number) => new Date(t0 - minutesAgo * 60_000).toISOString();
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];

  const state: Database = {
    version: SEED_VERSION,
    seededAt: new Date(t0).toISOString(),
    merchants: [
      ...MERCHANTS.map((m) => ({ ...m, createdAt: at(60 * 24 * 120) })),
      { id: "m_marketplace", name: "Partner Marketplace", tagline: "Live catalog via Channel3", color: "#0B1F4D", commissionRate: 0.06, monthlyBudget: 200_000, minShare: 0.05, maxShare: 0.6, holdMinutes: 2, paypalEmail: "payments@marketplace.example", createdAt: at(60 * 24 * 30) },
    ],
    products: PRODUCTS.map((p) => ({ ...p })),
    creators: CREATORS.map((c) => ({ ...c })),
    sources: SOURCES.map((s): Source => {
      const scr = screenWithRules(`${s.title}\n${s.excerpt}`);
      return { ...s, status: scr.decision === "approved" ? "active" : scr.decision === "review" ? "flagged" : "blocked", screening: { ...scr, engine: "rules", screenedAt: s.publishedAt } };
    }),
    attributions: [],
    sales: [],
    splits: [],
    payouts: [],
    ledger: [],
    activity: [],
    risk: [],
    apps: [{ id: "app_demo", name: "Demo Shopping Agent", apiKey: DEMO_API_KEY, createdAt: at(60 * 24 * 45), requests: 1284 }],
    webhookEvents: [],
    counters: {},
  };

  for (const s of state.sources.filter((x) => x.status !== "active")) {
    state.risk.push({ id: `risk_seed_${s.id}`, kind: "content_screening", severity: "high", message: `"${s.title}": ${s.screening?.summary}`, sourceId: s.id, creatorId: s.creatorId, status: "confirmed", createdAt: s.publishedAt });
  }

  // ~70 conversions over 30 days, weighted toward recent days.
  const total = 150;
  const events: { minutesAgo: number; i: number }[] = [];
  for (let i = 0; i < total; i++) events.push({ minutesAgo: Math.round(Math.pow(r(), 1.4) * 60 * 24 * 30) + 30, i });
  events.sort((a, b) => b.minutesAgo - a.minutesAgo);

  const cats = Object.keys(QUERIES) as Category[];
  for (const { minutesAgo, i } of events) {
    const category = pick(cats);
    const products = state.products.filter((p) => p.category === category && p.origin === "catalog");
    const product = pick(products);
    const alt = pick(products.filter((p) => p.id !== product.id));
    const direct = state.sources.filter((s) => s.status === "active" && s.productIds.includes(product.id));
    const altSrc = state.sources.filter((s) => s.status === "active" && s.productIds.includes(alt.id) && !direct.includes(s));
    const chosen = [...shuffle(direct, r).slice(0, 2 + Math.floor(r() * 2)), ...shuffle(altSrc, r).slice(0, 1)];
    // A handful of answers come from an agent that also cited the blocked spam source.
    if (i % 37 === 7) {
      const spam = state.sources.find((s) => s.id === "src_dealvault_spam");
      if (spam) chosen.push(spam);
    }
    const citations: Citation[] = chosen.map((s, idx) => ({
      n: idx + 1,
      sourceId: s.id,
      creatorId: s.creatorId,
      claim: s.excerpt.split(/(?<=[.!?])\s/)[0],
      productIds: s.productIds.filter((id) => id === product.id || id === alt.id),
    }));
    const created = at(minutesAgo + 4);
    const att = createAttributionRecord(state, {
      appId: "app_demo",
      channel: i % 5 === 0 ? "mcp" : "api",
      query: pick(QUERIES[category]),
      answer: `Recommended the ${product.title}, with the ${alt.title} as an alternative.`,
      productIds: [product.id, alt.id],
      citations,
      engine: "rules",
      createdAt: created,
    });
    const buyer = i === 41 ? "maya.chen@personal.example.com" : `buyer${(i * 37) % 997}@personal.example.com`;
    const sale = createSaleRecord(state, { attributionToken: att.token, productId: product.id, mode: "simulated", createdAt: at(minutesAgo + 2), buyerEmail: buyer });
    sale.status = "captured";
    sale.capturedAt = at(minutesAgo);
    sale.paypalOrderId = `SIM-ORDER-${(100000 + i * 7919).toString(36).toUpperCase()}`;
    sale.paypalCaptureId = `SIM-CAP-${(200000 + i * 104729).toString(36).toUpperCase()}`;
    log(state, { ts: sale.capturedAt, kind: "sale", saleId: sale.id, merchantId: sale.merchantId, message: `Payment captured: ${usd(sale.amount)} for ${sale.productTitle}` });
    const scored = scoreWithRules({ attribution: att, purchased: product, sources: state.sources, creators: state.creators });
    applySplit(state, sale.id, scored, "rules", sale.capturedAt);

    // A few historical refunds, all inside the return window: earnings are reversed before
    // payout, so no creator starts the demo owing a clawback.
    const releaseMinutes = 60 * 24 * 2;
    if (i === 12 || i === 33 || i === 58 || i === 101 || i === 140) {
      for (const p of state.payouts.filter((x) => x.saleId === sale.id)) p.releaseAt = new Date(new Date(sale.capturedAt).getTime() + releaseMinutes * 60_000).toISOString();
      applyRefund(state, sale.id, at(Math.max(5, minutesAgo - 60 * 24)));
      continue;
    }

    // Payouts older than the hold window have already been sent in batches.
    for (const p of state.payouts.filter((x) => x.saleId === sale.id)) {
      const creator = state.creators.find((c) => c.id === p.creatorId)!;
      p.releaseAt = new Date(new Date(sale.capturedAt).getTime() + releaseMinutes * 60_000).toISOString();
      if (minutesAgo > releaseMinutes && creator.paypalConnected && state.splits[0].risk.decision === "approved") {
        p.status = "sent";
        p.sentAt = p.releaseAt;
        p.mode = "simulated";
        p.batchId = `SIM-B${Math.floor((t0 - new Date(p.releaseAt).getTime()) / 86_400_000).toString().padStart(3, "0")}D`;
        p.note = undefined;
        state.ledger.push({ id: `led_seed_${p.id}`, ts: p.sentAt, type: "payout_sent", amount: -p.amount, creatorId: p.creatorId, payoutId: p.id, saleId: sale.id, memo: `Simulated payout batch ${p.batchId}` });
      } else if (creator.paypalConnected && state.splits[0].risk.decision === "approved") {
        p.note = "Return window: releases 48 h after capture";
      }
    }
  }

  // A live review case: one buyer converting through the same creator four times in a few hours.
  const burst = [300, 230, 160, 95];
  burst.forEach((minutesAgo, k) => {
    const product = state.products.find((p) => p.id === (k % 2 ? "p_burr_mini" : "p_pourover_kit"))!;
    const src = state.sources.find((s) => s.id === "src_priya_pourover")!;
    const att = createAttributionRecord(state, {
      appId: "app_demo",
      channel: "api",
      query: "how do I start making pour-over coffee",
      answer: `Recommended the ${product.title}.`,
      productIds: [product.id],
      citations: [{ n: 1, sourceId: src.id, creatorId: src.creatorId, claim: src.excerpt.split(/(?<=[.!?])\s/)[0], productIds: [product.id] }],
      engine: "rules",
      createdAt: at(minutesAgo + 3),
    });
    const sale = createSaleRecord(state, { attributionToken: att.token, productId: product.id, mode: "simulated", createdAt: at(minutesAgo + 1), buyerEmail: "repeat.buyer@personal.example.com" });
    sale.status = "captured";
    sale.capturedAt = at(minutesAgo);
    sale.paypalOrderId = `SIM-ORDER-BURST${k}`;
    sale.paypalCaptureId = `SIM-CAP-BURST${k}`;
    const scored = scoreWithRules({ attribution: att, purchased: product, sources: state.sources, creators: state.creators });
    applySplit(state, sale.id, scored, "rules", sale.capturedAt);
    for (const p of state.payouts.filter((x) => x.saleId === sale.id)) {
      p.releaseAt = new Date(new Date(sale.capturedAt).getTime() + 60 * 24 * 2 * 60_000).toISOString();
      if (state.splits[0].risk.decision === "approved") p.note = "Return window: releases 48 h after capture";
    }
  });

  state.activity.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  state.attributions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  state.sales.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  state.splits.sort((a, b) => (a.scoredAt < b.scoredAt ? 1 : -1));
  state.payouts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  state.ledger.sort((a, b) => (a.ts < b.ts ? -1 : 1));
  return state;
}

function shuffle<T>(xs: T[], r: () => number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
