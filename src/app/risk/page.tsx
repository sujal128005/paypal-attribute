import type { Metadata } from "next";
import { db } from "@/lib/store";
import { RiskClient, type RiskRow } from "./risk-client";

export const metadata: Metadata = { title: "Risk & trust" };
export const dynamic = "force-dynamic";

export default function RiskPage() {
  const s = db();
  const rows: RiskRow[] = s.risk.map((r) => {
    const creator = r.creatorId ? s.creators.find((c) => c.id === r.creatorId) : undefined;
    const sale = r.saleId ? s.sales.find((x) => x.id === r.saleId) : undefined;
    const source = r.sourceId ? s.sources.find((x) => x.id === r.sourceId) : undefined;
    return { ...r, creator: creator ? { name: creator.name, color: creator.color } : null, saleTitle: sale?.productTitle ?? null, sourceTitle: source?.title ?? null, sourceExcerpt: source?.excerpt ?? null };
  });
  const blockedSources = s.sources.filter((x) => x.status === "blocked").length;
  const excluded = s.splits.reduce((a, sp) => a + sp.shares.filter((sh) => sh.excluded && !/minimum/i.test(sh.excluded)).length, 0);
  return <RiskClient rows={JSON.parse(JSON.stringify(rows))} stats={{ open: rows.filter((r) => r.status === "open").length, blockedSources, excluded, reviewed: rows.filter((r) => r.status !== "open").length }} />;
}
