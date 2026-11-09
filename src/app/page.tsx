import Link from "next/link";
import { ArrowRight, BadgeCheck, Bot, CircleDollarSign, FileSearch, Quote, ShieldCheck, Sparkles, Undo2, Wallet } from "lucide-react";
import { Avatar, LinkButton, ProductArt } from "@/components/ui";
import { db } from "@/lib/store";
import { usd } from "@/lib/util";

export const dynamic = "force-dynamic";

function liveStats() {
  const s = db();
  const captured = s.sales.filter((x) => x.status === "captured");
  const paidCreators = new Set(s.payouts.filter((p) => p.status === "sent").map((p) => p.creatorId));
  const paid = s.payouts.filter((p) => p.status === "sent").reduce((a, p) => a + p.amount, 0);
  const citations = s.attributions.reduce((a, x) => a + x.citations.length, 0);
  return { revenue: captured.reduce((a, x) => a + x.amount, 0), paidCreators: paidCreators.size, paid, citations, sales: captured.length };
}

function showcase() {
  const s = db();
  const eligible = (min: number) => s.splits.find((sp) => sp.shares.filter((x) => x.amount > 0).length >= min && s.sales.find((x) => x.id === sp.saleId)?.status === "captured");
  const split = eligible(3) ?? eligible(2) ?? eligible(1);
  if (!split) return null;
  const sale = s.sales.find((x) => x.id === split.saleId)!;
  const att = s.attributions.find((a) => a.token === sale.attributionToken)!;
  const product = s.products.find((p) => p.id === sale.productId)!;
  return {
    sale,
    product,
    query: att.query,
    shares: split.shares
      .filter((x) => x.amount > 0)
      .map((x) => ({ ...x, creator: s.creators.find((c) => c.id === x.creatorId)! }))
      .sort((a, b) => b.amount - a.amount),
    pool: split.pool,
  };
}

export default function Home() {
  const stats = liveStats();
  const demo = showcase();

  return (
    <>
      {/* Hero */}
      <section className="container-page pb-16 pt-14 text-center md:pt-20">
        <Link href="/developers" className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full bg-[rgba(5,55,130,0.08)] px-4 py-2 text-[13.5px] font-semibold text-ink transition hover:bg-[rgba(5,55,130,0.14)]">
          <Sparkles size={15} className="text-blue" /> Built on PayPal Orders, Payouts &amp; Webhooks <ArrowRight size={14} />
        </Link>
        <h1 className="display-xl mx-auto max-w-[15ch]">Every AI answer has sources. Now every source gets paid.</h1>
        <p className="mx-auto mt-6 max-w-[640px] text-[18px] leading-relaxed text-[#3c4043] md:text-[19px]">
          PayPal Attribute is the payment rail for agentic commerce. AI shopping agents cite the creators behind each recommendation, and when the shopper pays with PayPal, those creators are paid automatically.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <LinkButton href="/shop" size="lg">
            Try Shop with AI
          </LinkButton>
          <LinkButton href="/attribution" variant="secondary" size="lg">
            See a sale traced
          </LinkButton>
        </div>
      </section>

      {/* Product showcase on sky band */}
      <section className="bg-sky">
        <div className="container-page grid items-center gap-10 py-16 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div>
            <h2 className="display-lg max-w-[16ch]">One question. {demo ? `${["One creator", "Two creators", "Three creators", "Four creators"][demo.shares.length - 1] ?? `${demo.shares.length} creators`}.` : "Many creators."} Paid in one batch.</h2>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink/80">
              The agent answers with footnotes. The attribution token rides inside the PayPal order. When the payment is captured, AI scores how much each source shaped the decision and splits the merchant&apos;s commission. You can explain every cent.
            </p>
            <LinkButton href={demo ? `/attribution/${demo.sale.id}` : "/attribution"} className="mt-8" size="lg">
              Open this sale&apos;s trace <ArrowRight size={17} />
            </LinkButton>
          </div>
          {demo && (
            <div className="relative">
              <div className="card p-5 md:p-6">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                  <Bot size={16} className="text-blue" /> Shopper asked
                </div>
                <p className="mt-1.5 font-display text-[22px] font-bold leading-tight">&ldquo;{demo.query}&rdquo;</p>
                <div className="mt-5 flex items-center gap-4 rounded-2xl bg-cloud p-4">
                  <ProductArt category={demo.product.category} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{demo.product.title}</p>
                    <p className="text-[13px] text-muted">Paid with PayPal · {usd(demo.sale.amount)}</p>
                  </div>
                  <BadgeCheck className="text-success" />
                </div>
                <p className="mt-5 text-[13px] font-semibold text-muted">Creator pool {usd(demo.pool)}, split by influence</p>
                <div className="mt-2 flex h-3 overflow-hidden rounded-full">
                  {demo.shares.map((s) => (
                    <span key={s.creatorId} className="animate-grow-x h-full" style={{ width: `${s.share * 100}%`, background: s.creator.color }} />
                  ))}
                </div>
                <ul className="mt-4 space-y-3">
                  {demo.shares.map((s) => (
                    <li key={s.creatorId} className="flex items-center gap-3">
                      <Avatar name={s.creator.name} color={s.creator.color} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-semibold">{s.creator.name}</p>
                        <p className="truncate text-[12.5px] text-muted">{s.reason}</p>
                      </div>
                      <p className="font-display text-[17px] font-bold tabular-nums">{usd(s.amount)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Live numbers */}
      <section className="container-page py-16">
        <p className="eyebrow text-center">Live from this sandbox</p>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            [usd(stats.revenue), "AI-attributed revenue"],
            [stats.citations.toLocaleString(), "Citations recorded"],
            [stats.paidCreators.toString(), "Creators paid"],
            [usd(stats.paid), "Paid out via PayPal"],
          ].map(([v, l]) => (
            <div key={l} className="card-flat p-6 text-center">
              <p className="font-display text-[34px] font-extrabold tracking-[-0.03em] tabular-nums md:text-[40px]">{v}</p>
              <p className="mt-1 text-[14px] font-medium text-muted">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section className="bg-navy text-white">
        <div className="container-page py-20">
          <h2 className="display-lg max-w-[18ch] text-white">AI agents are the new storefront. The affiliate economy hasn&apos;t caught up.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ["No click, no credit", "Agents answer “what should I buy?” directly. Affiliate links never get clicked, so the people whose reviews shaped the answer earn nothing."],
              ["Creators are the training data", "Reviewers, testers and guide writers do the work that makes AI recommendations trustworthy, and they're quietly losing their income."],
              ["Merchants are flying blind", "When an agent drives a sale, merchants can't see which conversation or which content sold it, or reward the people who did."],
            ].map(([h, b]) => (
              <div key={h} className="rounded-[var(--radius-card)] bg-white/[0.06] p-7 ring-1 ring-white/10">
                <p className="font-display text-[22px] font-bold text-sky">{h}</p>
                <p className="mt-3 leading-relaxed text-white/80">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 className="display-lg mt-3">From footnote to PayPal balance in four steps.</h2>
        </div>
        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            [Quote, "Cite", "The agent calls POST /v1/attributions with the sources it used and gets an attribution token."],
            [Wallet, "Check out", "The token rides inside the PayPal order as custom_id. The shopper pays with PayPal as usual."],
            [FileSearch, "Score", "On capture, AI scores each source's influence on the purchase. Risk checks remove fraud and spam."],
            [CircleDollarSign, "Pay", "After the return window, PayPal Payouts sends every creator their share in one batch."],
          ].map(([Icon, h, b], i) => {
            const I = Icon as typeof Quote;
            return (
              <li key={h as string} className="card relative p-6">
                <span className="absolute right-5 top-5 font-display text-[44px] font-extrabold leading-none text-mist">{i + 1}</span>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-soft text-deep">
                  <I size={22} />
                </span>
                <p className="mt-5 font-display text-[21px] font-bold">{h as string}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{b as string}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Audiences bento */}
      <section className="container-page pb-20">
        <div className="grid gap-5 lg:grid-cols-3">
          <Link href="/merchants" className="group flex min-h-[320px] flex-col justify-between rounded-[28px] bg-deep p-8 text-white transition hover:shadow-[var(--shadow-lift)]">
            <div>
              <p className="text-[14px] font-bold uppercase tracking-[0.12em] text-sky">Merchants</p>
              <p className="mt-4 font-display text-[30px] font-bold leading-tight">Pay only for AI sales that actually happened.</p>
            </div>
            <p className="flex items-center gap-2 font-semibold text-white/90 group-hover:gap-3">
              Commission rules, budget caps &amp; analytics <ArrowRight size={18} />
            </p>
          </Link>
          <Link href="/creators" className="group flex min-h-[320px] flex-col justify-between rounded-[28px] bg-sky p-8 transition hover:shadow-[var(--shadow-lift)]">
            <div>
              <p className="text-[14px] font-bold uppercase tracking-[0.12em] text-deep">Creators</p>
              <p className="mt-4 font-display text-[30px] font-bold leading-tight">Get paid whenever AI relies on your work.</p>
            </div>
            <p className="flex items-center gap-2 font-semibold group-hover:gap-3">
              Connect PayPal and register your content <ArrowRight size={18} />
            </p>
          </Link>
          <Link href="/developers" className="group flex min-h-[320px] flex-col justify-between rounded-[28px] bg-ink p-8 text-white transition hover:shadow-[var(--shadow-lift)]">
            <div>
              <p className="text-[14px] font-bold uppercase tracking-[0.12em] text-gold">Developers</p>
              <p className="mt-4 font-display text-[30px] font-bold leading-tight">One API key makes your agent&apos;s recommendations payable.</p>
            </div>
            <p className="flex items-center gap-2 font-semibold text-white/90 group-hover:gap-3">
              REST API, SDKs &amp; MCP server <ArrowRight size={18} />
            </p>
          </Link>
        </div>
      </section>

      {/* Trust */}
      <section className="bg-mist">
        <div className="container-page grid gap-12 py-20 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">Built for real money</p>
            <h2 className="display-lg mt-3">Explainable, reversible, hard to game.</h2>
            <p className="mt-5 text-[17px] leading-relaxed text-muted">Money only moves when the evidence holds up. Every split has a written reason, every payout has a ledger entry, and every refund unwinds automatically.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              [ShieldCheck, "Prompt-injection screening", "Content that tries to instruct AI agents is blocked before it can earn."],
              [BadgeCheck, "Self-dealing detection", "Creators can't buy through their own citations."],
              [Undo2, "Refund-aware payouts", "Hold windows reverse earnings on returns; later refunds are clawed back from future payouts."],
              [CircleDollarSign, "Exact to the cent", "Integer-cent ledger with largest-remainder rounding, so splits always sum to the pool."],
            ].map(([Icon, h, b]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <li key={h as string} className="rounded-2xl bg-white p-6">
                  <I className="text-blue" size={22} />
                  <p className="mt-3 font-semibold">{h as string}</p>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{b as string}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="container-page pt-20 text-center">
        <h2 className="display-lg mx-auto max-w-[20ch]">Ask an AI what to buy. Watch the people behind the answer get paid.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/shop" size="lg">
            Start the demo
          </LinkButton>
          <LinkButton href="/developers" variant="secondary" size="lg">
            Read the API
          </LinkButton>
        </div>
      </section>
    </>
  );
}
