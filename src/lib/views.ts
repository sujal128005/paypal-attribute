// Read models: join raw records into the shapes pages and the API return.
import { db } from "./store";
import type { Attribution, Database, Payout, Sale, Split } from "./types";

export function footnotes(att: Attribution, state: Database = db()) {
  return att.citations.map((c) => {
    const s = state.sources.find((x) => x.id === c.sourceId);
    const cr = state.creators.find((x) => x.id === c.creatorId);
    return {
      n: c.n,
      source_id: c.sourceId,
      creator_id: c.creatorId,
      creator: cr?.name ?? "Unknown",
      handle: cr?.handle ?? "",
      color: cr?.color ?? "#64748b",
      title: s?.title ?? "Removed source",
      url: s?.url ?? "",
      kind: s?.kind ?? "review",
      excerpt: s?.excerpt ?? "",
      claim: c.claim,
      product_ids: c.productIds,
    };
  });
}

export function attributionView(att: Attribution, state: Database = db()) {
  return {
    token: att.token,
    status: att.status,
    channel: att.channel,
    engine: att.engine,
    query: att.query,
    answer: att.answer,
    product_ids: att.productIds,
    footnotes: footnotes(att, state),
    created_at: att.createdAt,
    expires_at: att.expiresAt,
    checkout: { custom_id: att.token, note: "Pass this token as purchase_units[].custom_id when you create the PayPal order." },
  };
}

export function saleDetail(saleId: string, state: Database = db()) {
  const sale = state.sales.find((s) => s.id === saleId);
  if (!sale) return null;
  const att = state.attributions.find((a) => a.token === sale.attributionToken)!;
  const split = state.splits.find((s) => s.saleId === saleId) ?? null;
  const payouts = state.payouts.filter((p) => p.saleId === saleId);
  const merchant = state.merchants.find((m) => m.id === sale.merchantId)!;
  const product = state.products.find((p) => p.id === sale.productId);
  const ledger = state.ledger.filter((l) => l.saleId === saleId);
  const risk = state.risk.filter((r) => r.saleId === saleId);
  const creators = Object.fromEntries(state.creators.map((c) => [c.id, { name: c.name, handle: c.handle, color: c.color, paypalEmail: c.paypalEmail, connected: c.paypalConnected }]));
  return { sale, attribution: att, footnotes: footnotes(att, state), split, payouts, merchant, product, ledger, risk, creators };
}
export type SaleDetail = NonNullable<ReturnType<typeof saleDetail>>;

export function publicSale(sale: Sale, split: Split | null, payouts: Payout[]) {
  return {
    id: sale.id,
    status: sale.status,
    amount: { value: (sale.amount / 100).toFixed(2), currency: sale.currency },
    attribution_token: sale.attributionToken,
    paypal: { order_id: sale.paypalOrderId ?? null, capture_id: sale.paypalCaptureId ?? null, mode: sale.mode },
    split: split && {
      commission: split.commission / 100,
      platform_fee: split.platformFee / 100,
      creator_pool: split.pool / 100,
      engine: split.engine,
      risk_decision: split.risk.decision,
      shares: split.shares.map((s) => ({ creator_id: s.creatorId, influence: s.influence, share: Number(s.share.toFixed(4)), amount: s.amount / 100, reason: s.reason, excluded: s.excluded ?? null })),
    },
    payouts: payouts.map((p) => ({ id: p.id, creator_id: p.creatorId, amount: p.amount / 100, status: p.status, release_at: p.releaseAt, batch_id: p.batchId ?? null })),
    created_at: sale.createdAt,
    captured_at: sale.capturedAt ?? null,
  };
}

export function creatorEarnings(creatorId: string, state: Database = db()) {
  const payouts = state.payouts.filter((p) => p.creatorId === creatorId);
  const sum = (xs: Payout[]) => xs.reduce((a, p) => a + p.amount, 0);
  const clawback = -state.ledger.filter((l) => l.creatorId === creatorId && (l.type === "clawback" || l.type === "clawback_recovered")).reduce((a, l) => a + l.amount, 0);
  const citations = state.attributions.reduce((a, att) => a + att.citations.filter((c) => c.creatorId === creatorId).length, 0);
  return {
    paid: sum(payouts.filter((p) => p.status === "sent")),
    pending: sum(payouts.filter((p) => p.status === "held" || p.status === "released")),
    reversed: sum(payouts.filter((p) => p.status === "reversed")),
    clawbackOutstanding: Math.max(0, clawback),
    citations,
    sales: new Set(payouts.map((p) => p.saleId)).size,
  };
}
