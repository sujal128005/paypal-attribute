import type { Metadata } from "next";
import { releaseDuePayouts } from "@/lib/engine";
import { db } from "@/lib/store";
import { MerchantClient, type MerchantData } from "./merchant-client";

export const metadata: Metadata = { title: "Merchants" };
export const dynamic = "force-dynamic";

export default async function MerchantsPage({ searchParams }: { searchParams: Promise<{ merchant?: string }> }) {
  await releaseDuePayouts();
  const { merchant: requested } = await searchParams;
  const s = db();
  const merchants = s.merchants.filter((m) => m.id !== "m_marketplace" || s.sales.some((x) => x.merchantId === m.id));
  const merchant = merchants.find((m) => m.id === requested) ?? merchants[0];

  const sales = s.sales.filter((x) => x.merchantId === merchant.id && x.status !== "created");
  const rows = sales.map((sale) => {
    const split = s.splits.find((sp) => sp.saleId === sale.id);
    const paid = (split?.shares ?? []).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
    const att = s.attributions.find((a) => a.token === sale.attributionToken);
    return {
      id: sale.id,
      date: sale.capturedAt ?? sale.createdAt,
      product: sale.productTitle,
      query: att?.query ?? "",
      amount: sale.amount / 100,
      commission: (split?.commission ?? 0) / 100,
      creators: paid.map((x) => s.creators.find((c) => c.id === x.creatorId)?.name ?? "").join(", "),
      topCreator: paid[0] ? s.creators.find((c) => c.id === paid[0].creatorId)?.name ?? "" : "",
      sources: att?.citations.length ?? 0,
      engine: split?.engine ?? "rules",
      risk: split?.risk.decision ?? "approved",
      status: sale.status,
      mode: sale.mode,
    };
  });

  // Daily series for the last 30 days.
  const days: { day: string; revenue: number; commission: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const daySales = rows.filter((r) => r.date.slice(0, 10) === key && r.status === "captured");
    days.push({ day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), revenue: daySales.reduce((a, r) => a + r.amount, 0), commission: daySales.reduce((a, r) => a + r.commission, 0) });
  }

  const byCreator = new Map<string, { creator: string; earned: number; revenue: number; color: string }>();
  for (const sale of sales.filter((x) => x.status === "captured")) {
    const split = s.splits.find((sp) => sp.saleId === sale.id);
    for (const sh of split?.shares.filter((x) => x.amount > 0) ?? []) {
      const c = s.creators.find((x) => x.id === sh.creatorId)!;
      const row = byCreator.get(c.id) ?? { creator: c.name, earned: 0, revenue: 0, color: c.color };
      row.earned += sh.amount / 100;
      row.revenue += (sale.amount / 100) * sh.share;
      byCreator.set(c.id, row);
    }
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthCommission = rows.filter((r) => r.status === "captured" && new Date(r.date) >= monthStart).reduce((a, r) => a + r.commission, 0);
  const captured = rows.filter((r) => r.status === "captured");
  const revenue = captured.reduce((a, r) => a + r.amount, 0);
  const commission = captured.reduce((a, r) => a + r.commission, 0);

  const data: MerchantData = {
    merchants: merchants.map((m) => ({ id: m.id, name: m.name, color: m.color })),
    merchant,
    rows,
    days,
    creators: [...byCreator.values()].sort((a, b) => b.revenue - a.revenue).map((c) => ({ ...c, earned: +c.earned.toFixed(2), revenue: +c.revenue.toFixed(2) })),
    kpis: {
      revenue,
      commission,
      roc: commission ? revenue / commission : 0,
      orders: rows.length,
      refunds: rows.filter((r) => r.status === "refunded").length,
      monthCommission,
    },
  };
  return <MerchantClient data={JSON.parse(JSON.stringify(data))} />;
}
