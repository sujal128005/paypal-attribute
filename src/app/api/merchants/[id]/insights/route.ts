import { z } from "zod";
import { aiConfigured, merchantInsightAI } from "@/lib/ai";
import { EngineError } from "@/lib/engine";
import { fail, ok } from "@/lib/http";
import { db } from "@/lib/store";
import { usd } from "@/lib/util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ question: z.string().trim().min(3).max(300) });

function merchantFacts(merchantId: string) {
  const state = db();
  const merchant = state.merchants.find((m) => m.id === merchantId);
  if (!merchant) throw new EngineError("Unknown merchant", 404);
  const sales = state.sales.filter((s) => s.merchantId === merchantId && s.status !== "created");
  const splits = state.splits.filter((sp) => sales.some((s) => s.id === sp.saleId));
  const byCreator = new Map<string, { name: string; earned: number; sales: number; revenue: number }>();
  for (const sp of splits) {
    const sale = sales.find((s) => s.id === sp.saleId)!;
    if (sale.status !== "captured") continue;
    for (const sh of sp.shares.filter((x) => x.amount > 0)) {
      const c = state.creators.find((x) => x.id === sh.creatorId)!;
      const row = byCreator.get(c.id) ?? { name: c.name, earned: 0, sales: 0, revenue: 0 };
      row.earned += sh.amount;
      row.sales += 1;
      row.revenue += sale.amount;
      byCreator.set(c.id, row);
    }
  }
  const byProduct = new Map<string, { title: string; revenue: number; units: number; refunds: number }>();
  for (const s of sales) {
    const row = byProduct.get(s.productId) ?? { title: s.productTitle, revenue: 0, units: 0, refunds: 0 };
    row.units += 1;
    if (s.status === "refunded") row.refunds += 1;
    else row.revenue += s.amount;
    byProduct.set(s.productId, row);
  }
  const revenue = sales.filter((s) => s.status === "captured").reduce((a, s) => a + s.amount, 0);
  const commission = splits.reduce((a, s) => a + s.commission, 0);
  return {
    merchant: { name: merchant.name, commission_rate: merchant.commissionRate, monthly_budget_usd: merchant.monthlyBudget / 100 },
    totals: { ai_attributed_revenue_usd: revenue / 100, commission_paid_usd: commission / 100, orders: sales.length, refunds: sales.filter((s) => s.status === "refunded").length, return_on_commission: commission ? +(revenue / commission).toFixed(1) : null },
    creators: [...byCreator.values()].sort((a, b) => b.revenue - a.revenue).map((c) => ({ ...c, earned: c.earned / 100, revenue: c.revenue / 100 })),
    products: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).map((p) => ({ ...p, revenue: p.revenue / 100 })),
  };
}

function rulesAnswer(q: string, f: ReturnType<typeof merchantFacts>) {
  const top = f.creators[0];
  const topProduct = f.products[0];
  const ql = q.toLowerCase();
  if (/refund|return/.test(ql)) {
    const worst = [...f.products].sort((a, b) => b.refunds / b.units - a.refunds / a.units)[0];
    return `${f.totals.refunds} of ${f.totals.orders} AI-attributed orders were refunded. ${worst ? `${worst.title} has the highest refund rate (${worst.refunds}/${worst.units}).` : ""} Refunds inside the hold window cost you nothing: creator payouts are reversed automatically. Recommendation: keep the hold window at least as long as your return policy.`;
  }
  if (/product|sell|item/.test(ql) && topProduct) {
    return `${topProduct.title} is your top AI-attributed product with ${usd(topProduct.revenue * 100)} across ${topProduct.units} orders. Recommendation: send ${topProduct.title} samples to the creators already cited most for it.`;
  }
  if (/budget|spend|cost|commission/.test(ql)) {
    return `You've paid ${usd(f.totals.commission_paid_usd * 100)} in commission for ${usd(f.totals.ai_attributed_revenue_usd * 100)} of AI-attributed revenue, a ${f.totals.return_on_commission ?? 0}× return. Recommendation: commission only applies when a cited creator actually influenced a sale, so raising your rate a point is low-risk if you want more agent visibility.`;
  }
  if (!top) return "No AI-attributed sales yet. Once agents cite creators who review your products, results will show up here.";
  return `${top.name} drives the most AI-attributed revenue for you: ${usd(top.revenue * 100)} across ${top.sales} orders, earning ${usd(top.earned * 100)}. ${f.creators[1] ? `${f.creators[1].name} is next with ${usd(f.creators[1].revenue * 100)}.` : ""} Recommendation: offer ${top.name.split(" ")[0]} early access to new products. Their reviews are what AI agents trust when recommending you.`;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { question } = Body.parse(await req.json());
    const facts = merchantFacts(id);
    if (aiConfigured()) {
      try {
        const r = await merchantInsightAI(question, JSON.stringify(facts));
        return ok({ answer: r.text, engine: "ai", provider: r.provider });
      } catch (err) {
        console.warn("[insights] AI failed:", (err as Error).message);
      }
    }
    return ok({ answer: rulesAnswer(question, facts), engine: "rules" });
  } catch (err) {
    return fail(err);
  }
}
