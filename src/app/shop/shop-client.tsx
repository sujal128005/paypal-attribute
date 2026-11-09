"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Bot, Check, Lock, ShieldCheck, Sparkles, Star, X } from "lucide-react";
import { AnswerText, FootnoteList, type FootnoteView } from "@/components/answer";
import { PayPalButtons } from "@/components/paypal-buttons";
import { Avatar, Button, buttonClass, Pill, ProductArt } from "@/components/ui";
import type { Category } from "@/lib/types";
import { usd } from "@/lib/util";

interface ProductView {
  id: string;
  title: string;
  brand: string;
  category: Category;
  price: number;
  rating: number;
  features: string[];
  imageUrl?: string;
  merchant: string;
  commissionRate: number;
  origin: string;
}

interface AgentReply {
  token: string;
  engine: "ai" | "rules";
  provider?: string | null;
  answer: string;
  footnotes: FootnoteView[];
  products: ProductView[];
  expires_at: string;
}

type Msg = { role: "user"; text: string } | { role: "assistant"; reply: AgentReply } | { role: "error"; text: string };

interface SplitView {
  commission: number;
  pool: number;
  platformFee: number;
  engine: "ai" | "rules";
  summary: string;
  shares: { creatorId: string; amount: number; share: number; reason: string; excluded?: string; influence: number }[];
}

const SUGGESTIONS = [
  "Noise-cancelling headphones under $150 for my commute",
  "My first pair of running shoes",
  "How do I start making pour-over coffee?",
  "A carry-on that fits every airline",
  "Quiet air purifier for a small bedroom",
  "Beginner mirrorless camera for travel",
];

export function ShopClient({ config }: { config: { paypal: boolean; clientId: string; ai: boolean; aiLabel: string; channel3: boolean } }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkout, setCheckout] = useState<{ reply: AgentReply; product: ProductView } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const latest = [...messages].reverse().find((m): m is Extract<Msg, { role: "assistant" }> => m.role === "assistant")?.reply;

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    const history: { role: "user" | "assistant"; content: string }[] = messages.flatMap((m): { role: "user" | "assistant"; content: string }[] => (m.role === "user" ? [{ role: "user", content: m.text }] : m.role === "assistant" ? [{ role: "assistant", content: m.reply.answer }] : []));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/agent/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q, history }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "The agent could not answer");
      setMessages((m) => [...m, { role: "assistant", reply: json }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: (e as Error).message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page">
      <div className="flex flex-col gap-4 pb-6 pt-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-2">Shop with AI</p>
          <h1 className="display-lg">Ask. Get cited answers. Pay with PayPal.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone={config.ai ? "success" : "neutral"} dot>
            {config.ai ? `AI: ${config.aiLabel} → rules` : "Built-in rules agent"}
          </Pill>
          <Pill tone={config.paypal ? "success" : "warn"} dot>
            {config.paypal ? "PayPal sandbox" : "Simulated checkout"}
          </Pill>
          {config.channel3 && (
            <Pill tone="blue" dot>
              Channel3 catalog
            </Pill>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Chat */}
        <section className="card flex min-h-[640px] flex-col overflow-hidden" aria-label="Shopping assistant">
          <div className="flex-1 space-y-6 overflow-y-auto p-5 md:p-7">
            {messages.length === 0 && (
              <div className="flex flex-col items-center px-2 pb-6 pt-10 text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-soft text-deep">
                  <Sparkles size={26} />
                </span>
                <h2 className="mt-5 font-display text-[28px] font-bold">What are you shopping for?</h2>
                <p className="mt-2 max-w-md text-muted">Every claim the agent makes is footnoted to a real creator. Buy with PayPal and they get paid.</p>
                <div className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-white px-4 py-2.5 text-[14px] font-medium transition hover:border-ink hover:bg-cloud">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="animate-rise flex justify-end">
                  <p className="max-w-[80%] rounded-3xl rounded-br-lg bg-ink px-5 py-3 text-[15.5px] text-white">{m.text}</p>
                </div>
              ) : m.role === "error" ? (
                <div key={i} role="alert" className="animate-rise rounded-2xl bg-danger-soft px-5 py-3 text-[14.5px] text-danger">
                  {m.text}
                </div>
              ) : (
                <AssistantMessage key={i} reply={m.reply} onBuy={(product) => setCheckout({ reply: m.reply, product })} />
              ),
            )}

            {loading && (
              <div className="flex items-center gap-3 text-muted" aria-live="polite">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-soft text-deep">
                  <Bot size={18} />
                </span>
                <span className="typing text-[22px] leading-none tracking-widest">
                  <span>•</span>
                  <span>•</span>
                  <span>•</span>
                </span>
                <span className="text-[14px]">Searching products and reading creator reviews…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="border-t border-line bg-white p-3 md:p-4"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <div className="flex items-center gap-2 rounded-full border border-line bg-cloud py-1.5 pl-5 pr-1.5 focus-within:border-ink focus-within:bg-white">
              <label htmlFor="ask" className="sr-only">
                Ask the shopping assistant
              </label>
              <input
                id="ask"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. headphones under $150 for flights"
                className="min-w-0 flex-1 bg-transparent py-2 text-[15.5px] outline-none placeholder:text-subtle"
                maxLength={500}
                autoComplete="off"
              />
              <button type="submit" disabled={!input.trim() || loading} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white transition disabled:opacity-30" aria-label="Send">
                <ArrowUp size={19} />
              </button>
            </div>
          </form>
        </section>

        {/* Attribution receipt */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Attribution receipt">
          <div className="rounded-[var(--radius-card)] bg-navy p-6 text-white">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-sky">Attribution receipt</p>
            {latest ? (
              <>
                <p className="mt-3 break-all font-mono text-[13px] text-white/85">{latest.token}</p>
                <p className="mt-1 text-[12.5px] text-white/60">Travels inside the PayPal order as custom_id · valid 7 days</p>
                <ul className="mt-5 space-y-3">
                  {latest.footnotes.map((f) => (
                    <li key={f.n} className="flex items-center gap-3">
                      <Avatar name={f.creator} color={f.color} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{f.creator}</p>
                        <p className="truncate text-[12.5px] text-white/65">{f.title}</p>
                      </div>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[12px] font-bold">[{f.n}]</span>
                    </li>
                  ))}
                </ul>
                {!latest.footnotes.length && <p className="mt-4 text-[14px] text-white/70">No sources cited for this answer.</p>}
              </>
            ) : (
              <p className="mt-3 text-[14.5px] leading-relaxed text-white/75">Ask a question. Every source the agent relies on appears here, with the token that will carry them through checkout.</p>
            )}
          </div>
          <div className="card p-6">
            <p className="font-display text-[18px] font-bold">What happens when you pay</p>
            <ol className="mt-4 space-y-3.5 text-[14px] leading-snug">
              {[
                "PayPal captures the payment. The attribution token comes back with it.",
                "AI scores how much each cited source influenced this purchase.",
                "Risk checks remove self-dealing, spam and injected content.",
                "Creators are paid via PayPal Payouts after the return window.",
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-soft text-[11px] font-bold text-deep">{i + 1}</span>
                  <span className="text-[#3c4043]">{t}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      {checkout && <CheckoutDialog config={config} reply={checkout.reply} product={checkout.product} onClose={() => setCheckout(null)} />}
    </div>
  );
}

function AssistantMessage({ reply, onBuy }: { reply: AgentReply; onBuy: (p: ProductView) => void }) {
  return (
    <div className="animate-rise flex gap-3">
      <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-soft text-deep">
        <Bot size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="rounded-3xl rounded-tl-lg bg-cloud px-5 py-4">
          <AnswerText text={reply.answer} footnotes={reply.footnotes} />
          <FootnoteList footnotes={reply.footnotes} />
        </div>
        {reply.products.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {reply.products.map((p, idx) => (
              <div key={p.id} className="card flex flex-col p-4">
                <div className="flex gap-3.5">
                  <ProductArt category={p.category} imageUrl={p.imageUrl} size={60} />
                  <div className="min-w-0 flex-1">
                    {idx === 0 && (
                      <Pill tone="sky" className="mb-1.5">
                        Top pick
                      </Pill>
                    )}
                    <p className="font-semibold leading-tight">{p.title}</p>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {p.merchant} · <Star size={12} className="-mt-0.5 inline fill-current text-[#f5a524]" /> {p.rating}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="font-display text-[22px] font-bold tabular-nums">{usd(p.price)}</p>
                  <button onClick={() => onBuy(p)} className={buttonClass("gold", "sm", "px-5")}>
                    Buy with <span className="font-display font-extrabold italic tracking-tight">PayPal</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 pl-1 text-[12px] text-subtle">
          {reply.engine === "ai" ? `AI agent (${reply.provider ?? "AI"})` : "Built-in rules agent"} · {reply.footnotes.length} source{reply.footnotes.length === 1 ? "" : "s"} cited
        </p>
      </div>
    </div>
  );
}

function CheckoutDialog({ config, reply, product, onClose }: { config: { paypal: boolean; clientId: string }; reply: AgentReply; product: ProductView; onClose: () => void }) {
  const [state, setState] = useState<"pay" | "processing" | "done">("pay");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ saleId: string; split: SplitView | null } | null>(null);
  const [email, setEmail] = useState("shopper@personal.example.com");
  const dialogRef = useRef<HTMLDivElement>(null);
  const forProduct = reply.footnotes.filter((f) => !f.product_ids?.length || f.product_ids.includes(product.id));
  const cited = forProduct.length ? forProduct : reply.footnotes;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && state !== "processing" && onClose();
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, state]);

  const onCaptured = useCallback((r: { saleId: string; split: unknown }) => {
    setResult({ saleId: r.saleId, split: r.split as SplitView });
    setState("done");
  }, []);
  const onError = useCallback((m: string) => setError(m), []);

  async function simulate() {
    setError(null);
    setState("processing");
    try {
      const res = await fetch("/api/checkout/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: reply.token, productId: product.id, buyerEmail: email }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Checkout failed");
      onCaptured(json);
    } catch (e) {
      setError((e as Error).message);
      setState("pay");
    }
  }

  const creatorName = (id: string) => reply.footnotes.find((f) => f.creator_id === id)?.creator ?? id;
  const creatorColor = (id: string) => reply.footnotes.find((f) => f.creator_id === id)?.color ?? "#64748b";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={() => state !== "processing" && onClose()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
        className="animate-rise max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-[var(--shadow-lift)] outline-none sm:rounded-[28px] sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-[22px] font-bold">{state === "done" ? "Payment complete" : "Checkout"}</p>
          <button onClick={onClose} disabled={state === "processing"} className="rounded-full p-2 hover:bg-cloud" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {state !== "done" ? (
          <>
            <div className="mt-5 flex items-center gap-4 rounded-2xl bg-cloud p-4">
              <ProductArt category={product.category} imageUrl={product.imageUrl} size={56} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{product.title}</p>
                <p className="text-[13px] text-muted">Sold by {product.merchant}</p>
              </div>
              <p className="font-display text-[20px] font-bold tabular-nums">{usd(product.price)}</p>
            </div>
            <div className="mt-4 rounded-2xl border border-line p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                <Sparkles size={14} className="text-blue" /> AI-attributed purchase
              </p>
              <div className="mt-2.5 flex -space-x-2">
                {cited.map((f) => (
                  <span key={f.n} className="rounded-full ring-2 ring-white">
                    <Avatar name={f.creator} color={f.color} size={30} />
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-[13.5px] leading-snug text-[#3c4043]">
                {cited.length} creator source{cited.length === 1 ? "" : "s"} helped you decide. {product.merchant} pays a {Math.round(product.commissionRate * 100)}% commission, shared by influence. Your price doesn&apos;t change.
              </p>
            </div>

            <div className="mt-6">
              {config.paypal ? (
                <PayPalButtons clientId={config.clientId} token={reply.token} productId={product.id} onCaptured={onCaptured} onError={onError} />
              ) : (
                <>
                  <label className="block text-[13px] font-semibold text-muted" htmlFor="buyer">
                    Buyer email (sandbox)
                  </label>
                  <input id="buyer" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 text-[15px] outline-none focus:border-ink" />
                  <p className="mt-1.5 text-[12px] text-subtle">Tip: use a creator&apos;s email (e.g. maya.chen@personal.example.com) to see self-dealing detection.</p>
                  <button onClick={simulate} disabled={state === "processing"} className={buttonClass("gold", "lg", "mt-4 w-full")}>
                    {state === "processing" ? (
                      "Capturing payment…"
                    ) : (
                      <>
                        Pay with <span className="font-display font-extrabold italic tracking-tight">PayPal</span>
                      </>
                    )}
                  </button>
                  <p className="mt-2.5 text-center text-[12px] text-subtle">Simulated checkout. Add PayPal sandbox keys to use real PayPal buttons.</p>
                </>
              )}
              {error && (
                <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-2.5 text-[13.5px] text-danger">
                  {error}
                </p>
              )}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-subtle">
                <Lock size={12} /> Sandbox environment: no real money moves
              </p>
            </div>
          </>
        ) : (
          result && (
            <div className="mt-4">
              <div className="flex flex-col items-center py-4 text-center">
                <span className="animate-pulse-ring inline-flex h-16 w-16 items-center justify-center rounded-full bg-success text-white">
                  <Check size={32} strokeWidth={3} />
                </span>
                <p className="mt-4 font-display text-[24px] font-bold">{usd(product.price)} paid</p>
                <p className="mt-1 text-[14px] text-muted">Sale {result.saleId}</p>
              </div>
              {result.split && result.split.pool > 0 ? (
                <div className="rounded-2xl bg-cloud p-4">
                  <p className="text-[13px] font-semibold text-muted">
                    {usd(result.split.pool)} creator pool · {result.split.engine === "ai" ? "AI-scored" : "rules-scored"}
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {result.split.shares.map((s) => (
                      <li key={s.creatorId} className={`flex items-center gap-3 ${s.amount === 0 ? "opacity-55" : ""}`}>
                        <Avatar name={creatorName(s.creatorId)} color={creatorColor(s.creatorId)} size={30} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold">{creatorName(s.creatorId)}</p>
                          <p className="truncate text-[12px] text-muted">{s.excluded ?? s.reason}</p>
                        </div>
                        <p className="font-semibold tabular-nums">{s.amount ? usd(s.amount) : "-"}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted">
                    <ShieldCheck size={14} className="text-success" /> On hold for the return window, then paid via PayPal Payouts
                  </p>
                </div>
              ) : (
                <p className="rounded-2xl bg-cloud p-4 text-[14px] text-muted">{result.split?.summary ?? "Attribution is processing."}</p>
              )}
              <div className="mt-5 grid gap-2">
                <Link href={`/attribution/${result.saleId}`} className={buttonClass("primary", "lg", "w-full")}>
                  Watch the attribution trace <ArrowRight size={17} />
                </Link>
                <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
                  Keep shopping
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
