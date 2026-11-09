// Pure commission-split math. No I/O, fully unit-tested (tests/split.test.ts).
//
//   commission  = round(rate × amount)
//   platformFee = round(PLATFORM_FEE_RATE × commission)
//   pool        = commission − platformFee
//   share_i     = clamp( influence_i / Σ influence, minShare, maxShare )   (renormalised)
//   payout_i    = pool × share_i   (largest-remainder rounding so Σ payout_i == pool exactly)
import type { Cents } from "./types";

export const PLATFORM_FEE_RATE = 0.1;

export interface SplitCandidate {
  creatorId: string;
  sourceIds: string[];
  influence: number;
  reason: string;
  excluded?: string;
}

export interface SplitResult {
  commission: Cents;
  platformFee: Cents;
  pool: Cents;
  shares: {
    creatorId: string;
    sourceIds: string[];
    influence: number;
    share: number;
    amount: Cents;
    reason: string;
    excluded?: string;
  }[];
}

export function computeSplit(input: {
  amount: Cents;
  commissionRate: number;
  minShare: number;
  maxShare: number;
  candidates: SplitCandidate[];
}): SplitResult {
  const { amount, commissionRate, minShare, maxShare } = input;
  const out: SplitResult["shares"] = input.candidates.map((c) => ({
    creatorId: c.creatorId,
    sourceIds: c.sourceIds,
    influence: clamp(c.influence, 0, 100),
    share: 0,
    amount: 0,
    reason: c.reason,
    excluded: c.excluded,
  }));

  // 1. Start from eligible candidates with positive influence.
  let active = out.filter((s) => !s.excluded && s.influence > 0);
  for (const s of out) if (!s.excluded && s.influence <= 0) s.excluded = "No measurable influence on the recommendation";

  // 2. Drop trivial contributors one at a time (smallest first) until everyone clears the floor.
  for (;;) {
    const total = sum(active.map((s) => s.influence));
    if (!active.length || total === 0) break;
    const weakest = [...active].sort((a, b) => a.influence - b.influence)[0];
    if (active.length > 1 && weakest.influence / total < minShare) {
      weakest.excluded = `Below the ${Math.round(minShare * 100)}% minimum share`;
      active = active.filter((s) => s !== weakest);
      continue;
    }
    break;
  }

  if (!active.length) {
    return { commission: 0, platformFee: 0, pool: 0, shares: out };
  }

  // 3. Proportional shares, then water-fill the cap (only meaningful with 2+ creators).
  const total = sum(active.map((s) => s.influence));
  for (const s of active) s.share = s.influence / total;
  if (active.length > 1) {
    const cap = Math.max(maxShare, 1 / active.length);
    for (let i = 0; i < active.length; i++) {
      const over = active.filter((s) => s.share > cap + 1e-12);
      if (!over.length) break;
      let excess = 0;
      for (const s of over) {
        excess += s.share - cap;
        s.share = cap;
      }
      const under = active.filter((s) => s.share < cap - 1e-12);
      const underTotal = sum(under.map((s) => s.share));
      for (const s of under) s.share += excess * (s.share / underTotal);
    }
  }

  // 4. Money, in integer cents, with largest-remainder rounding.
  const commission = Math.round(amount * commissionRate);
  const platformFee = Math.round(commission * PLATFORM_FEE_RATE);
  const pool = commission - platformFee;
  const raw = active.map((s) => ({ s, exact: pool * s.share }));
  let allocated = 0;
  for (const r of raw) {
    r.s.amount = Math.floor(r.exact);
    allocated += r.s.amount;
  }
  const remainder = pool - allocated;
  raw
    .sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))
    .slice(0, remainder)
    .forEach((r) => (r.s.amount += 1));

  return { commission, platformFee, pool, shares: out };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
