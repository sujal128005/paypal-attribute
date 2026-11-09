import type { Metadata } from "next";
import { releaseDuePayouts } from "@/lib/engine";
import { loginWithPayPalEnabled } from "@/lib/paypal";
import { db } from "@/lib/store";
import { creatorEarnings } from "@/lib/views";
import { CreatorClient, type CreatorData } from "./creator-client";

export const metadata: Metadata = { title: "Creators" };
export const dynamic = "force-dynamic";

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ creator?: string; connected?: string }> }) {
  await releaseDuePayouts();
  const { creator: requested, connected } = await searchParams;
  const s = db();
  const visible = s.creators.filter((c) => c.id !== "cr_dealvault");
  const creator = s.creators.find((c) => c.id === requested) ?? visible[0];

  const payouts = s.payouts.filter((p) => p.creatorId === creator.id);
  const rows = payouts.map((p) => {
    const sale = s.sales.find((x) => x.id === p.saleId)!;
    const split = s.splits.find((sp) => sp.saleId === p.saleId);
    const share = split?.shares.find((x) => x.creatorId === creator.id);
    const att = s.attributions.find((a) => a.token === sale.attributionToken);
    const cited = att?.citations.filter((c) => c.creatorId === creator.id).map((c) => s.sources.find((x) => x.id === c.sourceId)?.title ?? "") ?? [];
    return {
      id: p.id,
      saleId: p.saleId,
      date: sale.capturedAt ?? sale.createdAt,
      product: sale.productTitle,
      query: att?.query ?? "",
      cited: cited.join(" · "),
      share: share?.share ?? 0,
      amount: p.amount / 100,
      status: p.status,
      releaseAt: p.releaseAt,
      batchId: p.batchId ?? "",
    };
  });

  const days: { day: string; earned: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), earned: +rows.filter((r) => r.date.slice(0, 10) === key && r.status !== "reversed").reduce((a, r) => a + r.amount, 0).toFixed(2) });
  }

  const sources = s.sources
    .filter((x) => x.creatorId === creator.id)
    .map((src) => ({
      ...src,
      citations: s.attributions.reduce((a, att) => a + att.citations.filter((c) => c.sourceId === src.id).length, 0),
      earned: s.splits.reduce((a, sp) => a + (sp.shares.find((sh) => sh.creatorId === creator.id && sh.sourceIds[0] === src.id)?.amount ?? 0), 0),
    }));

  const data: CreatorData = {
    creators: visible.map((c) => ({ id: c.id, name: c.name, color: c.color, connected: c.paypalConnected })),
    creator,
    earnings: creatorEarnings(creator.id),
    rows,
    days,
    sources,
    products: s.products.filter((p) => p.origin === "catalog").map((p) => ({ id: p.id, title: p.title, category: p.category })),
    paypalLive: loginWithPayPalEnabled(),
    connected: connected ?? null,
  };
  return <CreatorClient data={JSON.parse(JSON.stringify(data))} />;
}
