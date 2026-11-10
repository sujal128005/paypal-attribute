// The attribution engine: citations → sale → AI-scored split → held payouts → PayPal Payouts,
// with refunds driving reversals and clawbacks. Every money movement writes a ledger entry.
import { aiConfigured, scoreInfluenceAI, screenContentAI } from "./ai";
import { createPayoutBatch, PayPalError, paypalConfigured } from "./paypal";
import { assessRisk } from "./risk";
import { scoreWithRules, screenWithRules, type ScoredSource } from "./scoring";
import { computeSplit, type SplitCandidate } from "./split";
import { db, mutate } from "./store";
import type { ActivityEvent, Attribution, Database, LedgerEntry, Payout, Sale, Source, SourceKind, Category, Split } from "./types";
import { randomId, usd } from "./util";

export const ATTRIBUTION_TTL_DAYS = 7;

const now = () => new Date().toISOString();

export function log(state: Database, e: Omit<ActivityEvent, "id" | "ts"> & { ts?: string }) {
  state.activity.unshift({ id: randomId("evt", 10), ts: e.ts ?? now(), ...e });
  if (state.activity.length > 600) state.activity.length = 600;
}

function ledger(state: Database, e: Omit<LedgerEntry, "id" | "ts"> & { ts?: string }) {
  state.ledger.push({ id: randomId("led", 12), ts: e.ts ?? now(), ...e });
}

// ─── Attribution ────────────────────────────────────────────────────────────
export function createAttributionRecord(
  state: Database,
  input: Omit<Attribution, "token" | "createdAt" | "expiresAt" | "status"> & { createdAt?: string },
): Attribution {
  const created = input.createdAt ?? now();
  const att: Attribution = {
    ...input,
    token: randomId("att", 18),
    createdAt: created,
    expiresAt: new Date(new Date(created).getTime() + ATTRIBUTION_TTL_DAYS * 86_400_000).toISOString(),
    status: "open",
  };
  state.attributions.unshift(att);
  const creators = [...new Set(att.citations.map((c) => c.creatorId))].length;
  log(state, { ts: created, kind: "attribution", message: `Agent answered "${truncate(att.query, 60)}" citing ${att.citations.length} source${att.citations.length === 1 ? "" : "s"} from ${creators} creator${creators === 1 ? "" : "s"}` });
  return att;
}

// ─── Sales ──────────────────────────────────────────────────────────────────
export function createSaleRecord(state: Database, input: { attributionToken: string; productId: string; mode: Sale["mode"]; createdAt?: string; buyerEmail?: string }): Sale {
  const att = state.attributions.find((a) => a.token === input.attributionToken);
  if (!att) throw new EngineError("Unknown attribution token", 404);
  if (!att.productIds.includes(input.productId)) throw new EngineError("Product was not part of this recommendation", 400);
  const product = state.products.find((p) => p.id === input.productId);
  if (!product) throw new EngineError("Unknown product", 404);
  const sale: Sale = {
    id: randomId("sale", 12),
    attributionToken: att.token,
    merchantId: product.merchantId,
    productId: product.id,
    productTitle: product.title,
    amount: product.price,
    currency: "USD",
    status: "created",
    mode: input.mode,
    buyerEmail: input.buyerEmail,
    createdAt: input.createdAt ?? now(),
  };
  state.sales.unshift(sale);
  return sale;
}

export class EngineError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Score influence outside the write lock (AI calls can take seconds). */
export async function scoreSale(saleId: string, opts: { allowAi?: boolean } = {}): Promise<{ scored: ScoredSource[]; engine: "ai" | "rules"; provider?: string }> {
  const state = db();
  const sale = state.sales.find((s) => s.id === saleId);
  if (!sale) throw new EngineError("Unknown sale", 404);
  const att = state.attributions.find((a) => a.token === sale.attributionToken)!;
  const product = state.products.find((p) => p.id === sale.productId)!;
  const rules = scoreWithRules({ attribution: att, purchased: product, sources: state.sources, creators: state.creators });
  if (opts.allowAi === false || !aiConfigured() || !att.citations.length) return { scored: rules, engine: "rules" };
  try {
    const { scores: ai, provider } = await scoreInfluenceAI({
      query: att.query,
      answer: att.answer,
      purchasedTitle: product.title,
      purchasedFeatures: product.features,
      sources: att.citations.map((c) => {
        const s = state.sources.find((x) => x.id === c.sourceId);
        const cr = state.creators.find((x) => x.id === c.creatorId);
        return { id: c.sourceId, creator: cr?.name ?? "Unknown", title: s?.title ?? "", excerpt: s?.excerpt ?? "", claim: c.claim, position: c.n };
      }),
    });
    // Blend with the rules baseline so a single model response can't swing money wildly.
    const blended = rules.map((r) => {
      const a = ai.find((x) => x.source_id === r.sourceId);
      return a ? { ...r, influence: Math.round(0.75 * Math.min(100, Math.max(0, a.influence)) + 0.25 * r.influence), reason: a.reason } : r;
    });
    return { scored: blended, engine: "ai", provider };
  } catch (err) {
    console.warn("[engine] AI scoring failed, using rules:", (err as Error).message);
    return { scored: rules, engine: "rules" };
  }
}

/** Turn a captured sale into a split, held payouts and ledger entries. Idempotent per sale. */
export function applySplit(state: Database, saleId: string, scored: ScoredSource[], engine: "ai" | "rules", at = now(), provider?: string): Split {
  const existing = state.splits.find((s) => s.saleId === saleId);
  if (existing) return existing;
  const sale = state.sales.find((s) => s.id === saleId)!;
  const merchant = state.merchants.find((m) => m.id === sale.merchantId)!;
  const att = state.attributions.find((a) => a.token === sale.attributionToken)!;

  const projected = Math.round(sale.amount * merchant.commissionRate);
  const risk = assessRisk({ state, sale, merchant, attribution: att, scored, projectedCommission: projected });

  // One share per creator: strongest source counts fully, extra sources add a little (anti-stuffing).
  const byCreator = new Map<string, ScoredSource[]>();
  for (const s of scored) byCreator.set(s.creatorId, [...(byCreator.get(s.creatorId) ?? []), s]);
  const candidates: SplitCandidate[] = [...byCreator.entries()].map(([creatorId, list]) => {
    const sorted = [...list].sort((a, b) => b.influence - a.influence);
    const influence = Math.min(100, sorted[0].influence + sorted.slice(1).reduce((a, s) => a + s.influence * 0.15, 0));
    return { creatorId, sourceIds: sorted.map((s) => s.sourceId), influence, reason: sorted[0].reason, excluded: risk.excludedCreators.get(creatorId) };
  });

  const result = risk.decision === "blocked"
    ? { commission: 0, platformFee: 0, pool: 0, shares: candidates.map((c) => ({ ...c, share: 0, amount: 0, excluded: c.excluded ?? "Attribution blocked by risk checks" })) }
    : computeSplit({ amount: sale.amount, commissionRate: merchant.commissionRate, minShare: merchant.minShare, maxShare: merchant.maxShare, candidates });

  const paid = result.shares.filter((s) => s.amount > 0);
  const summary = !paid.length
    ? "No eligible sources. The merchant is not charged a commission."
    : `${usd(result.commission)} commission split across ${paid.length} creator${paid.length === 1 ? "" : "s"}; ${usd(result.platformFee)} PayPal network fee.`;

  const split: Split = {
    saleId,
    commissionRate: merchant.commissionRate,
    commission: result.commission,
    platformFee: result.platformFee,
    pool: result.pool,
    shares: result.shares,
    engine,
    provider,
    scoredAt: at,
    risk: { decision: risk.decision, checks: risk.checks },
    summary,
    scores: scored.map((x) => ({ sourceId: x.sourceId, creatorId: x.creatorId, influence: x.influence, reason: x.reason })),
  };
  state.splits.unshift(split);
  att.status = "converted";

  if (result.commission > 0) {
    ledger(state, { ts: at, type: "commission_accrued", amount: -result.commission, saleId, merchantId: merchant.id, memo: `${(merchant.commissionRate * 100).toFixed(0)}% commission on ${sale.productTitle}` });
    ledger(state, { ts: at, type: "platform_fee", amount: result.platformFee, saleId, memo: "PayPal Attribute network fee" });
  }
  const releaseAt = new Date(new Date(at).getTime() + merchant.holdMinutes * 60_000).toISOString();
  for (const s of paid) {
    const creator = state.creators.find((c) => c.id === s.creatorId)!;
    const payout: Payout = {
      id: randomId("po", 12),
      saleId,
      creatorId: s.creatorId,
      amount: s.amount,
      status: "held",
      releaseAt,
      createdAt: at,
      note:
        risk.decision === "review"
          ? "Held for risk review"
          : !creator.paypalConnected
            ? "Waiting for creator to connect PayPal"
            : `Return window: releases ${merchant.holdMinutes} min after capture (demo)`,
    };
    state.payouts.unshift(payout);
    ledger(state, { ts: at, type: "creator_earning", amount: s.amount, saleId, creatorId: s.creatorId, payoutId: payout.id, memo: `${Math.round(s.share * 100)}% of the creator pool` });
  }

  for (const f of risk.flags) {
    state.risk.unshift({ id: randomId("risk", 10), kind: f.kind, severity: f.severity, message: f.message, saleId, creatorId: f.creatorId, sourceId: f.sourceId, status: risk.decision === "review" ? "open" : "confirmed", createdAt: at });
  }
  log(state, { ts: at, kind: "split", saleId, merchantId: merchant.id, message: `${engine === "ai" ? `AI (${provider ?? "model"})` : "Rules"}-scored split for ${sale.productTitle}: ${summary}` });
  if (risk.flags.length) log(state, { ts: at, kind: "risk", saleId, message: `${risk.flags.length} risk signal${risk.flags.length === 1 ? "" : "s"} on ${sale.id}: ${risk.flags.map((f) => f.kind.replace(/_/g, " ")).join(", ")}` });
  return split;
}

/** Called after PayPal capture (or simulated capture). Safe to call twice. */
export async function processCapturedSale(saleId: string, capture: { captureId?: string; payerEmail?: string }) {
  await mutate((state) => {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) throw new EngineError("Unknown sale", 404);
    if (sale.status === "captured") return;
    sale.status = "captured";
    sale.capturedAt = now();
    sale.paypalCaptureId = capture.captureId ?? sale.paypalCaptureId;
    sale.buyerEmail = capture.payerEmail ?? sale.buyerEmail;
    log(state, { kind: "sale", saleId, merchantId: sale.merchantId, message: `${sale.mode === "paypal" ? "PayPal" : "Simulated"} payment captured: ${usd(sale.amount)} for ${sale.productTitle}` });
  });
  if (db().splits.some((s) => s.saleId === saleId)) return db().splits.find((s) => s.saleId === saleId)!;
  const { scored, engine, provider } = await scoreSale(saleId);
  return mutate((state) => applySplit(state, saleId, scored, engine, undefined, provider));
}

// ─── Payout release ─────────────────────────────────────────────────────────
function clawbackDebt(state: Database, creatorId: string) {
  return -state.ledger
    .filter((l) => l.creatorId === creatorId && (l.type === "clawback" || l.type === "clawback_recovered"))
    .reduce((a, l) => a + l.amount, 0);
}

export async function releaseDuePayouts(opts: { force?: boolean; saleId?: string } = {}) {
  // 1. Claim eligible payouts under the lock so they can't be sent twice.
  const claimed = await mutate((state) => {
    const t = Date.now();
    const picked: Payout[] = [];
    for (const p of state.payouts) {
      if (p.status !== "held") continue;
      if (opts.saleId && p.saleId !== opts.saleId) continue;
      const sale = state.sales.find((s) => s.id === p.saleId);
      const split = state.splits.find((s) => s.saleId === p.saleId);
      const creator = state.creators.find((c) => c.id === p.creatorId);
      if (!sale || sale.status !== "captured" || !split || !creator) continue;
      if (split.risk.decision !== "approved") continue;
      if (!creator.paypalConnected) {
        p.note = "Waiting for creator to connect PayPal";
        continue;
      }
      if (!opts.force && new Date(p.releaseAt).getTime() > t) continue;
      // Net any outstanding clawback debt against this payout.
      const debt = clawbackDebt(state, p.creatorId);
      if (debt > 0) {
        const recovered = Math.min(debt, p.amount);
        p.amount -= recovered;
        ledger(state, { type: "clawback_recovered", amount: recovered, creatorId: p.creatorId, payoutId: p.id, saleId: p.saleId, memo: "Recovered earlier refund from this payout" });
        p.note = `${usd(recovered)} netted against an earlier refund`;
      }
      if (p.amount <= 0) {
        p.status = "sent";
        p.sentAt = now();
        p.batchId = "OFFSET";
        p.note = "Fully offset against an earlier refund: nothing to send";
        continue;
      }
      p.status = "released";
      picked.push({ ...p });
    }
    return picked;
  });
  if (!claimed.length) return { batches: [] as { batchId: string; mode: string; count: number; total: number }[] };

  // 2. Send one batch per mode (real PayPal sales via the Payouts API, simulated sales locally).
  const groups = new Map<"paypal" | "simulated", Payout[]>();
  for (const p of claimed) {
    const sale = db().sales.find((s) => s.id === p.saleId)!;
    const mode = sale.mode === "paypal" && paypalConfigured() ? "paypal" : "simulated";
    groups.set(mode, [...(groups.get(mode) ?? []), p]);
  }
  const batches: { batchId: string; mode: string; count: number; total: number }[] = [];
  for (const [requestedMode, items] of groups) {
    let mode: "paypal" | "simulated" = requestedMode;
    let batchId = `SIM-${randomId("B", 10).slice(2)}`;
    let failed: string | undefined;
    let fallbackNote: string | undefined;
    if (mode === "paypal") {
      try {
        const res = await createPayoutBatch({
          senderBatchId: randomId("attr_batch", 14),
          items: items.map((p) => {
            const c = db().creators.find((x) => x.id === p.creatorId)!;
            const sale = db().sales.find((s) => s.id === p.saleId)!;
            return { payoutId: p.id, email: c.paypalEmail, amount: p.amount, note: `Your content was cited by an AI shopping agent in a purchase of ${sale.productTitle}.` };
          }),
        });
        batchId = res.batch_header.payout_batch_id;
      } catch (err) {
        const msg = (err as Error).message;
        // Account-level blocks (e.g. Payouts not permitted for the sandbox merchant's country)
        // will never succeed on retry: settle in the simulated ledger and say why, instead of
        // leaving creators stuck on hold. Transient errors (5xx, network) keep retrying.
        const permanent = err instanceof PayPalError && (err.status === 401 || err.status === 403 || err.status === 422 || /not allowed|permission|not enabled|not authori|country/i.test(msg));
        if (permanent) {
          mode = "simulated";
          fallbackNote = `Simulated batch: PayPal Payouts is not available for this sandbox merchant account (${msg})`;
        } else failed = msg;
      }
    }
    await mutate((state) => {
      for (const it of items) {
        const p = state.payouts.find((x) => x.id === it.id)!;
        if (failed) {
          p.status = "held";
          p.note = `PayPal Payouts error, will retry: ${failed}`;
          continue;
        }
        p.status = "sent";
        p.sentAt = now();
        p.batchId = batchId;
        if (!p.note?.includes("netted")) p.note = fallbackNote;
        p.mode = mode;
        ledger(state, { type: "payout_sent", amount: -p.amount, creatorId: p.creatorId, payoutId: p.id, saleId: p.saleId, memo: `${mode === "paypal" ? "PayPal Payouts" : "Simulated payout"} batch ${batchId}` });
      }
      if (!failed) {
        const total = items.reduce((a, p) => a + p.amount, 0);
        log(state, { kind: "payout", message: `${mode === "paypal" ? "PayPal Payouts" : "Simulated"} batch ${batchId}: ${items.length} creator payout${items.length === 1 ? "" : "s"}, ${usd(total)}` });
        batches.push({ batchId, mode, count: items.length, total });
      }
    });
  }
  return { batches };
}

// ─── Refunds & clawbacks ───────────────────────────────────────────────────
export function applyRefund(state: Database, saleId: string, at = now()) {
  const sale = state.sales.find((s) => s.id === saleId);
  if (!sale) throw new EngineError("Unknown sale", 404);
  if (sale.status === "refunded") return sale;
  if (sale.status !== "captured") throw new EngineError("Only captured sales can be refunded", 409);
  sale.status = "refunded";
  sale.refundedAt = at;
  let reversed = 0;
  let clawed = 0;
  for (const p of state.payouts.filter((x) => x.saleId === saleId)) {
    if (p.status === "held" || p.status === "released") {
      p.status = "reversed";
      p.note = "Reversed: buyer refunded inside the return window";
      reversed += p.amount;
      ledger(state, { ts: at, type: "payout_reversed", amount: -p.amount, creatorId: p.creatorId, payoutId: p.id, saleId, memo: "Refund before payout: earning cancelled" });
    } else if (p.status === "sent") {
      clawed += p.amount;
      ledger(state, { ts: at, type: "clawback", amount: -p.amount, creatorId: p.creatorId, payoutId: p.id, saleId, memo: "Refund after payout: recovered from future earnings" });
    }
  }
  const split = state.splits.find((s) => s.saleId === saleId);
  if (split && split.commission > 0) {
    ledger(state, { ts: at, type: "commission_accrued", amount: split.commission, saleId, merchantId: sale.merchantId, memo: "Commission returned to merchant on refund" });
    ledger(state, { ts: at, type: "platform_fee", amount: -split.platformFee, saleId, memo: "Network fee returned on refund" });
  }
  log(state, { ts: at, kind: "refund", saleId, merchantId: sale.merchantId, message: `Refund on ${sale.productTitle}: ${usd(reversed)} of held payouts reversed${clawed ? `, ${usd(clawed)} queued as clawback` : ""}` });
  return sale;
}

// ─── Creator content ───────────────────────────────────────────────────────
export async function registerSource(input: { creatorId: string; title: string; url: string; kind: SourceKind; excerpt: string; categories: Category[]; productIds: string[] }) {
  let screening: Source["screening"];
  if (aiConfigured()) {
    try {
      const r = await screenContentAI(input);
      screening = { ...r, engine: "ai", screenedAt: now() };
    } catch (err) {
      console.warn("[engine] AI screening failed, using rules:", (err as Error).message);
    }
  }
  if (!screening) screening = { ...screenWithRules(`${input.title}\n${input.excerpt}`), engine: "rules", screenedAt: now() };
  return mutate((state) => {
    if (!state.creators.some((c) => c.id === input.creatorId)) throw new EngineError("Unknown creator", 404);
    const keywords = [...new Set(`${input.title} ${input.excerpt}`.toLowerCase().match(/[a-z0-9-]{4,}/g) ?? [])].slice(0, 14);
    const source: Source = {
      id: randomId("src", 10).toLowerCase(),
      creatorId: input.creatorId,
      title: input.title,
      url: input.url,
      kind: input.kind,
      categories: input.categories,
      productIds: input.productIds,
      keywords,
      excerpt: input.excerpt,
      publishedAt: now(),
      status: screening!.decision === "approved" ? "active" : screening!.decision === "review" ? "flagged" : "blocked",
      screening,
    };
    state.sources.unshift(source);
    if (screening!.decision !== "approved") {
      state.risk.unshift({ id: randomId("risk", 10), kind: "content_screening", severity: screening!.decision === "blocked" ? "high" : "medium", message: `"${truncate(source.title, 50)}": ${screening!.summary}`, sourceId: source.id, creatorId: source.creatorId, status: "open", createdAt: now() });
    }
    log(state, { kind: "source", creatorId: input.creatorId, message: `New source "${truncate(source.title, 50)}" screened: ${screening!.decision}` });
    return source;
  });
}

export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
