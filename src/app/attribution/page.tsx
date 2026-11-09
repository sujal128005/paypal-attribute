import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar, LinkButton, PageHeader, ProductArt, StatusPill } from "@/components/ui";
import { releaseDuePayouts } from "@/lib/engine";
import { db } from "@/lib/store";
import { relativeTime, usd } from "@/lib/util";

export const metadata: Metadata = { title: "Sale attribution" };
export const dynamic = "force-dynamic";

export default async function AttributionIndex() {
  await releaseDuePayouts();
  const s = db();
  const rows = s.sales
    .filter((x) => x.status !== "created")
    .slice(0, 30)
    .map((sale) => {
      const split = s.splits.find((sp) => sp.saleId === sale.id);
      const product = s.products.find((p) => p.id === sale.productId)!;
      const att = s.attributions.find((a) => a.token === sale.attributionToken)!;
      const creators = (split?.shares ?? []).filter((x) => x.amount > 0).map((x) => s.creators.find((c) => c.id === x.creatorId)!);
      return { sale, split, product, att, creators };
    });

  return (
    <div className="container-page">
      <PageHeader
        eyebrow="Sale attribution"
        title="Every sale, traced to the people behind it."
        description="Pick any AI-attributed sale to see the question, the citations, the PayPal capture, the AI influence scores, the risk checks, the split and the payouts, step by step."
        actions={<LinkButton href="/shop">Make a new sale</LinkButton>}
      />
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_120px_120px_110px_24px] gap-4 border-b border-line bg-cloud px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-subtle md:grid">
          <span>Purchase</span>
          <span>Shopper asked</span>
          <span>Creators paid</span>
          <span className="text-right">Commission</span>
          <span>Status</span>
          <span />
        </div>
        <ul className="divide-y divide-line">
          {rows.map(({ sale, split, product, att, creators }) => (
            <li key={sale.id}>
              <Link href={`/attribution/${sale.id}`} className="grid items-center gap-3 px-5 py-4 transition hover:bg-cloud md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_120px_120px_110px_24px] md:gap-4 md:px-6">
                <span className="flex min-w-0 items-center gap-3.5">
                  <ProductArt category={product.category} imageUrl={product.imageUrl} size={44} className="rounded-xl" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{sale.productTitle}</span>
                    <span className="block text-[13px] text-muted">
                      {usd(sale.amount)} · {relativeTime(sale.capturedAt ?? sale.createdAt)}
                      {sale.mode === "paypal" && <span className="ml-1.5 font-semibold text-blue">PayPal sandbox</span>}
                    </span>
                  </span>
                </span>
                <span className="truncate text-[14px] text-[#3c4043]">&ldquo;{att.query}&rdquo;</span>
                <span className="flex -space-x-2">
                  {creators.slice(0, 4).map((c) => (
                    <span key={c.id} className="rounded-full ring-2 ring-white" title={c.name}>
                      <Avatar name={c.name} color={c.color} size={28} />
                    </span>
                  ))}
                  {!creators.length && <span className="text-[13px] text-subtle">None</span>}
                </span>
                <span className="text-[14px] font-semibold tabular-nums md:text-right">{split ? usd(split.commission) : "-"}</span>
                <span>
                  <StatusPill status={sale.status === "refunded" ? "refunded" : split?.risk.decision === "review" ? "review" : "captured"} />
                </span>
                <ArrowRight size={18} className="hidden text-subtle md:block" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
