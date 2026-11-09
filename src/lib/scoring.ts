// Deterministic influence scoring. Used when no AI key is configured, and as a
// sanity baseline the AI score is blended with so one model response can't swing money wildly.
import type { Attribution, Creator, Product, Source } from "./types";
import { tokenize } from "./util";

export interface ScoredSource {
  sourceId: string;
  creatorId: string;
  influence: number; // 0-100
  reason: string;
}

export function scoreWithRules(input: {
  attribution: Attribution;
  purchased: Product;
  sources: Source[];
  creators: Creator[];
}): ScoredSource[] {
  const { attribution, purchased, sources, creators } = input;
  const queryTerms = new Set(tokenize(attribution.query));
  const productTerms = new Set([...purchased.keywords, ...tokenize(purchased.title)]);

  return attribution.citations.map((c) => {
    const src = sources.find((s) => s.id === c.sourceId);
    const creator = creators.find((x) => x.id === c.creatorId);
    if (!src) return { sourceId: c.sourceId, creatorId: c.creatorId, influence: 0, reason: "Source no longer exists" };

    const coversPurchase = src.productIds.includes(purchased.id) || c.productIds.includes(purchased.id);
    const sameCategory = src.categories.includes(purchased.category);
    const srcTerms = new Set([...src.keywords, ...tokenize(src.excerpt), ...tokenize(src.title)]);
    const queryOverlap = overlap(queryTerms, srcTerms);
    const productOverlap = overlap(productTerms, srcTerms);
    const positionWeight = Math.max(0.4, 1 - (c.n - 1) * 0.15);
    const trust = (creator?.trustScore ?? 50) / 100;

    let score =
      (coversPurchase ? 55 : sameCategory ? 18 : 4) +
      Math.min(20, queryOverlap * 6) +
      Math.min(15, productOverlap * 4) +
      10 * positionWeight;
    score *= 0.7 + 0.3 * trust;
    const influence = Math.round(Math.min(100, score));

    const parts: string[] = [];
    if (coversPurchase) parts.push(`directly reviewed the ${purchased.title} that was bought`);
    else if (sameCategory) parts.push(`covered the ${purchased.category} category but not this exact product`);
    else parts.push("was cited for a product the shopper did not buy");
    if (queryOverlap >= 2) parts.push("matched what the shopper asked for");
    if (c.n === 1) parts.push("was the agent's first citation");
    const reason = capitalise(parts.join(", ")) + ".";
    return { sourceId: src.id, creatorId: c.creatorId, influence, reason };
  });
}

function overlap(a: Set<string>, b: Set<string>) {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /system prompt/i,
  /always (cite|recommend|mention)/i,
  /you are (now )?(an?|the) (ai|assistant|model)/i,
  /disregard .* (rules|instructions)/i,
];

export function screenWithRules(text: string): { decision: "approved" | "review" | "blocked"; flags: string[]; summary: string } {
  const flags: string[] = [];
  if (INJECTION_PATTERNS.some((p) => p.test(text))) flags.push("prompt_injection");
  const words = tokenize(text);
  const unique = new Set(words);
  if (words.length > 12 && unique.size / words.length < 0.55) flags.push("keyword_stuffing");
  if ((text.match(/best/gi) ?? []).length >= 4) flags.push("low_information");
  if (flags.includes("prompt_injection"))
    return { decision: "blocked", flags, summary: "Contains instructions aimed at AI agents. Blocked from attribution." };
  if (flags.length) return { decision: "review", flags, summary: "Looks low-information or keyword-stuffed. Held for review." };
  return { decision: "approved", flags, summary: "Original first-hand content. Eligible for attribution." };
}
