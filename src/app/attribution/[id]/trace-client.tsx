"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Banknote, Bot, Braces, CheckCircle2, CircleDollarSign, Clock, CreditCard, Gauge, MessageSquare, RotateCcw, Send, ShieldAlert, ShieldCheck, Undo2, XCircle } from "lucide-react";
import { AnswerText } from "@/components/answer";
import { Avatar, Button, Pill, ProductArt, StatusPill } from "@/components/ui";
import type { SaleDetail } from "@/lib/views";
import { usd } from "@/lib/util";
import { Time } from "@/components/time";

export function TraceClient({ initial, paypalLive }: { initial: SaleDetail; paypalLive: boolean }) {
  const [d, setD] = useState<SaleDetail>(initial);
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/sales/${initial.sale.id}`, { cache: "no-store" });
    if (res.ok) setD(await res.json());
  }, [initial.sale.id]);

  // Tick clock and poll for payout progress while anything is on hold.
  const pending = d.payouts.some((p) => p.status === "held" || p.status === "released");
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = pending ? setInterval(refresh, 4000) : undefined;
    return () => {
      clearInterval(tick);
      if (poll) clearInterval(poll);
    };
  }, [pending, refresh]);

  async function act(kind: "release" | "refund") {
    if (kind === "refund" && !confirm("Refund this sale? Held payouts are reversed; sent payouts become clawbacks.")) return;
    setBusy(kind);
    await fetch(kind === "release" ? "/api/payouts/release" : `/api/sales/${d.sale.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: kind === "release" ? JSON.stringify({ saleId: d.sale.id, force: true }) : undefined,
    });
    await refresh();
    setBusy(null);
  }

  const { sale, attribution: att, split, payouts, merchant, product, footnotes, creators } = d;
  const paidShares = split?.shares.filter((s) => s.amount > 0) ?? [];
  const sourceInfluence = (sourceId: string) => split?.shares.find((s) => s.sourceIds.includes(sourceId));
  const releaseAt = payouts[0] ? new Date(payouts[0].releaseAt).getTime() : 0;
  const remaining = now === null ? null : Math.max(0, releaseAt - now);
  const allSent = payouts.length > 0 && payouts.every((p) => p.status === "sent");
  const batches = [...new Set(payouts.filter((p) => p.batchId && p.batchId !== "OFFSET").map((p) => p.batchId!))];

  const steps: { icon: typeof Bot; title: string; meta?: ReactNode; tone?: "done" | "active" | "warn" | "danger"; body: ReactNode }[] = [
    {
      icon: MessageSquare,
      title: "Shopper asked an AI agent",
      meta: <><Time iso={att.createdAt} /> · via {att.channel === "shop-demo" ? "Shop with AI" : att.channel.toUpperCase()}</>,
      body: <p className="font-display text-[20px] font-bold leading-snug">&ldquo;{att.query}&rdquo;</p>,
    },
    {
      icon: Bot,
      title: `Agent answered, citing ${footnotes.length} source${footnotes.length === 1 ? "" : "s"}`,
      meta: att.engine === "ai" ? `AI agent (${att.provider ?? "AI"})` : "Agent",
      body: (
        <div className="rounded-2xl bg-cloud p-4">
          <AnswerText text={att.answer} footnotes={footnotes} />
          <div className="mt-3 flex flex-wrap gap-2">
            {footnotes.map((f) => (
              <span key={f.n} className="inline-flex max-w-full items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[13px] ring-1 ring-line">
                <Avatar name={f.creator} color={f.color} size={22} />
                <span className="font-semibold">[{f.n}]</span> <span className="min-w-0 max-w-[220px] truncate text-muted">{f.title}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 font-mono text-[12px] text-muted">attribution_token: {att.token}</p>
        </div>
      ),
    },
    {
      icon: CreditCard,
      title: sale.mode === "paypal" ? "PayPal order created with the token" : "Checkout order created with the token",
      meta: sale.paypalOrderId,
      body: (
        <pre className="code-block !p-4 text-[12.5px]">{`POST /v2/checkout/orders
{
  "intent": "CAPTURE",
  "purchase_units": [{
    "reference_id": "${sale.id}",
    "custom_id": "${att.token}",
    "amount": { "currency_code": "USD", "value": "${(sale.amount / 100).toFixed(2)}" }
  }]
}`}</pre>
      ),
    },
    {
      icon: CheckCircle2,
      title: sale.status === "created" ? "Waiting for payment" : "Payment captured",
      meta: sale.capturedAt ? <Time iso={sale.capturedAt} /> : undefined,
      tone: sale.status === "created" ? "active" : "done",
      body: (
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
          <KV k="Capture ID" v={sale.paypalCaptureId ?? "-"} mono />
          <KV k="Amount" v={usd(sale.amount)} />
          <KV k="Buyer" v={sale.buyerEmail ?? "-"} />
          <KV k="Mode" v={sale.mode === "paypal" ? "PayPal sandbox" : "Simulated"} />
        </div>
      ),
    },
    {
      icon: Gauge,
      title: `Influence scored by ${split?.engine === "ai" ? `AI (${split.provider ?? "model"})` : "the built-in rules engine"}`,
      meta: split ? <Time iso={split.scoredAt} /> : undefined,
      body: split ? (
        <ul className="space-y-3">
          {footnotes.map((f) => {
            const inf = split.scores?.find((x) => x.sourceId === f.source_id)?.influence ?? sourceInfluence(f.source_id)?.influence ?? 0;
            return (
              <li key={f.n} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[200px_minmax(0,1fr)_44px]">
                <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold">
                  <Avatar name={f.creator} color={f.color} size={24} /> <span className="truncate">{f.creator}</span>
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-mist">
                  <span className="animate-grow-x block h-full rounded-full" style={{ width: `${inf}%`, background: f.color }} />
                </span>
                <span className="text-right font-mono text-[13px] font-semibold tabular-nums">{Math.round(inf)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted">Scoring runs when the payment is captured.</p>
      ),
    },
    {
      icon: split?.risk.decision === "approved" ? ShieldCheck : ShieldAlert,
      title: `Risk checks: ${split?.risk.decision ?? "pending"}`,
      tone: split?.risk.decision === "approved" ? "done" : split?.risk.decision === "review" ? "warn" : split ? "danger" : "active",
      body: split ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {split.risk.checks.map((c) => (
            <li key={c.id} className="flex gap-2.5 rounded-xl bg-cloud p-3 text-[13.5px]">
              {c.passed ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />}
              <span>
                <span className="block font-semibold">{c.label}</span>
                <span className="text-muted">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null,
    },
    {
      icon: CircleDollarSign,
      title: "Commission split",
      meta: split?.summary,
      body: split ? (
        <div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Money label={`${Math.round(split.commissionRate * 100)}% commission`} value={split.commission} />
            <Money label="PayPal network fee" value={split.platformFee} />
            <Money label="Creator pool" value={split.pool} strong />
          </div>
          {paidShares.length > 0 && (
            <div className="mt-4 flex h-4 overflow-hidden rounded-full">
              {paidShares.map((s) => (
                <span key={s.creatorId} className="animate-grow-x h-full" style={{ width: `${s.share * 100}%`, background: creators[s.creatorId]?.color }} title={creators[s.creatorId]?.name} />
              ))}
            </div>
          )}
          <ul className="mt-4 divide-y divide-line rounded-2xl ring-1 ring-line">
            {split.shares.map((s) => (
              <li key={s.creatorId} className={`flex items-start gap-3 p-4 ${s.amount === 0 ? "bg-cloud/60" : ""}`}>
                <Avatar name={creators[s.creatorId]?.name ?? "?"} color={creators[s.creatorId]?.color ?? "#999"} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {creators[s.creatorId]?.name} <span className="font-normal text-muted">{creators[s.creatorId]?.handle}</span>
                  </p>
                  <p className={`mt-0.5 text-[13.5px] leading-snug ${s.excluded ? "text-danger" : "text-[#3c4043]"}`}>{s.excluded ?? s.reason}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-[18px] font-bold tabular-nums">{s.amount ? usd(s.amount) : "$0.00"}</p>
                  <p className="text-[12px] text-muted">{s.amount ? `${(s.share * 100).toFixed(1)}%` : "excluded"}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null,
    },
    {
      icon: allSent ? Send : Clock,
      title: allSent ? (payouts.every((p) => p.mode === "paypal") ? "Paid via PayPal Payouts" : "Paid (simulated payout batch)") : sale.status === "refunded" ? "Payouts unwound" : "Payouts on hold for the return window",
      tone: allSent ? "done" : sale.status === "refunded" ? "danger" : payouts.length ? "active" : "done",
      meta: batches.length ? `Batch ${batches.join(", ")}` : undefined,
      body: payouts.length ? (
        <div>
          {!allSent && sale.status === "captured" && split?.risk.decision === "approved" && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-sky-soft p-4">
              <Clock size={18} className="text-deep" />
              <p className="flex-1 text-[14px] text-deep">
                {remaining === null ? (
                  "Checking the hold window…"
                ) : remaining > 0 ? (
                  <>
                    Releases in <span className="font-mono font-bold tabular-nums">{fmt(remaining)}</span> ({merchant.holdMinutes}-minute demo hold; production would use {merchant.name}&apos;s return window)
                  </>
                ) : (
                  "Hold window over. Sending in the next batch…"
                )}
              </p>
              <Button size="sm" onClick={() => act("release")} disabled={busy !== null}>
                {busy === "release" ? "Sending…" : "Release now"}
              </Button>
            </div>
          )}
          <ul className="space-y-2">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-cloud p-3">
                <Avatar name={creators[p.creatorId]?.name ?? "?"} color={creators[p.creatorId]?.color ?? "#999"} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">
                    {creators[p.creatorId]?.name} <span className="font-normal text-muted">→ {creators[p.creatorId]?.paypalEmail}</span>
                  </p>
                  <p className="text-[12.5px] text-muted">{p.note ?? (p.batchId ? `${p.mode === "paypal" ? "PayPal Payouts" : "Simulated"} batch ${p.batchId}` : p.id)}</p>
                </div>
                <span className="font-semibold tabular-nums">{usd(p.amount)}</span>
                <StatusPill status={p.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted">No creator earned a payout from this sale.</p>
      ),
    },
  ];
  if (sale.status === "refunded") {
    steps.push({
      icon: Undo2,
      title: "Refunded: earnings reversed",
      tone: "danger",
      meta: sale.refundedAt ? <Time iso={sale.refundedAt} /> : undefined,
      body: (
        <ul className="space-y-1.5 text-[14px]">
          {d.ledger
            .filter((l) => ["payout_reversed", "clawback"].includes(l.type))
            .map((l) => (
              <li key={l.id} className="flex justify-between gap-4">
                <span>
                  {creators[l.creatorId ?? ""]?.name}: {l.memo}
                </span>
                <span className="font-mono tabular-nums text-danger">{usd(l.amount)}</span>
              </li>
            ))}
        </ul>
      ),
    });
  }

  return (
    <div className="container-page pb-10">
      <Link href="/attribution" className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> All sales
      </Link>
      <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <ProductArt category={product?.category ?? "home"} imageUrl={product?.imageUrl} size={76} className="rounded-3xl" />
          <div>
            <p className="eyebrow">Attribution trace</p>
            <h1 className="mt-1 font-display text-[32px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{sale.productTitle}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-muted">
              <span className="font-semibold text-ink">{usd(sale.amount)}</span> · {merchant.name} · <span className="font-mono text-[13px]">{sale.id}</span>
              <StatusPill status={sale.status} />
              {sale.mode === "paypal" ? <Pill tone="blue">PayPal sandbox</Pill> : <Pill>Simulated payment</Pill>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowJson((v) => !v)}>
            <Braces size={15} /> {showJson ? "Hide" : "Raw"} JSON
          </Button>
          {sale.status === "captured" && (
            <Button variant="secondary" size="sm" onClick={() => act("refund")} disabled={busy !== null} className="!text-danger">
              <RotateCcw size={15} /> {busy === "refund" ? "Refunding…" : `Refund${sale.mode === "paypal" && paypalLive ? " via PayPal" : ""}`}
            </Button>
          )}
        </div>
      </div>

      {showJson && <pre className="code-block mt-6 max-h-[420px] text-[12px]">{JSON.stringify({ sale, split, payouts }, null, 2)}</pre>}

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ol className="relative">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const tone = s.tone ?? "done";
            const ring = { done: "bg-ink text-white", active: "bg-blue text-white animate-pulse-ring", warn: "bg-warn text-white", danger: "bg-danger text-white" }[tone];
            return (
              <li key={i} className="animate-rise relative grid grid-cols-[44px_minmax(0,1fr)] gap-4 pb-8" style={{ animationDelay: `${i * 110}ms` }}>
                {i < steps.length - 1 && <span className="absolute left-[21px] top-11 h-[calc(100%-44px)] w-0.5 bg-line" />}
                <span className={`relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-full ${ring}`}>
                  <Icon size={20} />
                </span>
                <div className="card min-w-0 p-5">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-display text-[18px] font-bold">{s.title}</p>
                    {s.meta && <p className="text-[12.5px] text-muted">{s.meta}</p>}
                  </div>
                  {s.body}
                </div>
              </li>
            );
          })}
        </ol>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius-card)] bg-navy p-6 text-white">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-sky">Where the money went</p>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <Row k="Shopper paid" v={usd(sale.amount)} />
              <Row k={`Merchant keeps`} v={usd(sale.amount - (split?.commission ?? 0))} />
              <Row k="Creators" v={usd(split?.pool ?? 0)} />
              <Row k="PayPal network fee" v={usd(split?.platformFee ?? 0)} />
            </ul>
            <div className="mt-5 border-t border-white/15 pt-4">
              <p className="text-[12.5px] text-white/65">Ledger entries for this sale</p>
              <p className="font-display text-[28px] font-bold">{d.ledger.length}</p>
            </div>
          </div>
          <div className="card p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Banknote size={18} className="text-blue" /> Ledger
            </p>
            <ul className="mt-3 space-y-2 text-[13px]">
              {d.ledger.map((l) => (
                <li key={l.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-muted" title={l.memo}>
                    {l.type.replace(/_/g, " ")}
                    {l.creatorId ? ` · ${creators[l.creatorId]?.name.split(" ")[0]}` : ""}
                  </span>
                  <span className={`font-mono tabular-nums ${l.amount < 0 ? "text-danger" : "text-success"}`}>{usd(l.amount, { sign: true })}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-subtle">{k}</p>
      <p className={`mt-0.5 font-semibold ${mono ? "font-mono text-[13px]" : ""}`}>{v}</p>
    </div>
  );
}

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${strong ? "bg-sky-soft" : "bg-cloud"}`}>
      <p className="font-display text-[20px] font-bold tabular-nums">{usd(value)}</p>
      <p className="text-[12px] text-muted">{label}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex justify-between">
      <span className="text-white/75">{k}</span>
      <span className="font-semibold tabular-nums">{v}</span>
    </li>
  );
}
