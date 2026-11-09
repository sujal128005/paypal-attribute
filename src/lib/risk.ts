// Fraud & abuse checks run on every captured sale before money is allocated.
import type { Attribution, Creator, Database, Merchant, RiskCheck, Sale } from "./types";
import type { ScoredSource } from "./scoring";

export interface RiskOutcome {
  decision: "approved" | "review" | "blocked";
  checks: RiskCheck[];
  excludedCreators: Map<string, string>;
  flags: { kind: "self_dealing" | "citation_stuffing" | "prompt_injection" | "budget_cap" | "velocity"; severity: "low" | "medium" | "high"; message: string; creatorId?: string; sourceId?: string }[];
}

export function assessRisk(input: {
  state: Database;
  sale: Sale;
  merchant: Merchant;
  attribution: Attribution;
  scored: ScoredSource[];
  projectedCommission: number;
}): RiskOutcome {
  const { state, sale, merchant, attribution, scored, projectedCommission } = input;
  const checks: RiskCheck[] = [];
  const excluded = new Map<string, string>();
  const flags: RiskOutcome["flags"] = [];
  const creatorsById = new Map(state.creators.map((c) => [c.id, c] as [string, Creator]));

  // 1. Self-dealing: the buyer is one of the cited creators.
  const buyer = sale.buyerEmail?.toLowerCase();
  const selfDealer = buyer ? scored.find((s) => creatorsById.get(s.creatorId)?.paypalEmail.toLowerCase() === buyer) : undefined;
  if (selfDealer) {
    excluded.set(selfDealer.creatorId, "Buyer and creator are the same PayPal account");
    flags.push({ kind: "self_dealing", severity: "high", message: `Buyer ${buyer} is cited creator ${creatorsById.get(selfDealer.creatorId)?.name}`, creatorId: selfDealer.creatorId });
  }
  checks.push({ id: "self_dealing", label: "No self-dealing", passed: !selfDealer, detail: selfDealer ? "A cited creator bought through their own citation — their share is removed." : "Buyer is not one of the cited creators." });

  // 2. Blocked or injected content.
  const blocked = attribution.citations.filter((c) => {
    const src = state.sources.find((s) => s.id === c.sourceId);
    return !src || src.status === "blocked";
  });
  for (const b of blocked) {
    excluded.set(b.creatorId, "Source failed content screening (instructions aimed at AI agents)");
    flags.push({ kind: "prompt_injection", severity: "high", message: `Blocked source ${b.sourceId} was cited — excluded from the split`, sourceId: b.sourceId, creatorId: b.creatorId });
  }
  checks.push({ id: "content", label: "Clean sources", passed: blocked.length === 0, detail: blocked.length ? `${blocked.length} cited source(s) failed screening and earn nothing.` : "Every cited source passed content screening." });

  // 3. Citation stuffing: a single creator cited many times in one answer.
  const perCreator = new Map<string, number>();
  for (const c of attribution.citations) perCreator.set(c.creatorId, (perCreator.get(c.creatorId) ?? 0) + 1);
  const stuffed = [...perCreator.entries()].filter(([, n]) => n > 2);
  for (const [creatorId, n] of stuffed) flags.push({ kind: "citation_stuffing", severity: "low", message: `${creatorsById.get(creatorId)?.name} cited ${n}× — collapsed to one share`, creatorId });
  checks.push({ id: "stuffing", label: "No citation stuffing", passed: stuffed.length === 0, detail: stuffed.length ? "Repeated citations from one creator were collapsed into a single share." : "Each creator's weight comes from distinct contributions." });

  // 4. Merchant budget cap.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const spent = state.splits
    .filter((sp) => {
      const s = state.sales.find((x) => x.id === sp.saleId);
      return s && s.merchantId === merchant.id && s.status === "captured" && new Date(s.capturedAt ?? s.createdAt) >= monthStart;
    })
    .reduce((a, sp) => a + sp.commission, 0);
  const overBudget = spent + projectedCommission > merchant.monthlyBudget;
  if (overBudget) flags.push({ kind: "budget_cap", severity: "medium", message: `${merchant.name} would exceed its monthly attribution budget` });
  checks.push({ id: "budget", label: "Within merchant budget", passed: !overBudget, detail: overBudget ? "Commission would exceed the merchant's monthly cap — held for merchant approval." : `${Math.round(((spent + projectedCommission) / merchant.monthlyBudget) * 100)}% of the monthly budget used.` });

  // 5. Velocity: same buyer converting through the same creator repeatedly in 24h.
  const dayAgo = Date.now() - 86_400_000;
  const recent = buyer
    ? state.sales.filter((s) => s.id !== sale.id && s.buyerEmail?.toLowerCase() === buyer && new Date(s.createdAt).getTime() > dayAgo)
    : [];
  const velocityHit = recent.length >= 3;
  if (velocityHit) flags.push({ kind: "velocity", severity: "medium", message: `Buyer made ${recent.length + 1} attributed purchases in 24h` });
  checks.push({ id: "velocity", label: "Normal purchase velocity", passed: !velocityHit, detail: velocityHit ? "Unusual repeat purchases — payouts held for review." : "Purchase pattern looks organic." });

  // 6. Attribution freshness.
  const fresh = new Date(attribution.expiresAt).getTime() > new Date(sale.createdAt).getTime();
  checks.push({ id: "fresh", label: "Attribution window valid", passed: fresh, detail: fresh ? "Purchase happened inside the attribution window." : "Attribution token had expired at purchase time." });

  const decision: RiskOutcome["decision"] = !fresh ? "blocked" : overBudget || velocityHit ? "review" : "approved";
  return { decision, checks, excludedCreators: excluded, flags };
}
