"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, Boxes, Check, Copy, FileJson, KeyRound, Play, Plug, Send, Webhook } from "lucide-react";
import { Button, buttonClass, Pill } from "@/components/ui";

export interface DevData {
  base: string;
  apps: { id: string; name: string; apiKey: string; requests: number; createdAt: string }[];
  products: { id: string; title: string }[];
  sources: { id: string; title: string; productIds: string[]; creator: string }[];
  endpoints: { method: string; path: string; summary: string; description: string; operationId: string }[];
}

type Lang = "ts" | "py" | "curl" | "mcp";

export function DevClient({ data }: { data: DevData }) {
  const [lang, setLang] = useState<Lang>("ts");
  const key = data.apps[0]?.apiKey ?? "pa_test_…";
  const snippets = useMemo(() => buildSnippets(data.base, key), [data.base, key]);

  return (
    <>
      <section className="bg-ink text-white">
        <div className="container-page grid gap-12 py-16 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-gold">Developers</p>
            <h1 className="display-lg mt-3 !text-white">Make your agent&apos;s recommendations payable.</h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/75">
              One REST call when your agent answers. One field on the PayPal order. PayPal Attribute handles influence scoring, fraud checks, holds, refunds and creator payouts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#playground" className={buttonClass("gold", "lg")}>
                Try the API live
              </a>
              <a href="/api/v1/openapi.json" target="_blank" className={buttonClass("inverse", "lg")}>
                <FileJson size={17} /> OpenAPI spec
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {["REST + JSON", "OpenAPI 3.1", "Postman collection", "MCP server", "PayPal sandbox"].map((t) => (
                <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold text-white/85">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="min-w-0 rounded-3xl bg-[#0b1426] ring-1 ring-white/10">
            <div className="flex gap-1 overflow-x-auto border-b border-white/10 p-2" role="tablist" aria-label="Language">
              {(
                [
                  ["ts", "TypeScript"],
                  ["py", "Python"],
                  ["curl", "cURL"],
                  ["mcp", "MCP"],
                ] as [Lang, string][]
              ).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={lang === id} onClick={() => setLang(id)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${lang === id ? "bg-white text-ink" : "text-white/70 hover:text-white"}`}>
                  {label}
                </button>
              ))}
              <CopyButton text={snippets[lang]} className="ml-auto" />
            </div>
            <pre className="max-h-[440px] overflow-auto p-5 font-mono text-[12.5px] leading-relaxed text-[#d6e2ff]">{snippets[lang]}</pre>
          </div>
        </div>
      </section>

      <div className="container-page">
        <section className="py-16">
          <p className="eyebrow">Integration in three steps</p>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[
              ["1", "Register citations", "When your agent shows a recommendation, POST the products and the sources it relied on to /v1/attributions. You get back an attribution token and footnotes to render."],
              ["2", "Attach to the PayPal order", "Create the PayPal order as you already do and set purchase_units[].custom_id to the token. Nothing else in your checkout changes."],
              ["3", "There is no step 3", "On capture, PayPal Attribute scores influence, runs risk checks, holds for the return window and pays creators with PayPal Payouts. Refunds unwind automatically."],
            ].map(([n, h, b]) => (
              <div key={n} className="card-flat p-6">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display font-bold text-white">{n}</span>
                <p className="mt-4 font-display text-[20px] font-bold">{h}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{b}</p>
              </div>
            ))}
          </div>
        </section>

        <Playground data={data} apiKey={key} />

        <div className="mt-16 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section>
            <h2 className="font-display text-[24px] font-bold">API reference</h2>
            <p className="mt-1 text-muted">
              Base URL <code className="kbd">{data.base}/api/v1</code> · Auth <code className="kbd">Authorization: Bearer pa_test_…</code>
            </p>
            <ul className="card mt-5 divide-y divide-line">
              {data.endpoints.map((e) => (
                <li key={e.method + e.path} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className={`w-16 rounded-md py-1 text-center font-mono text-[12px] font-bold ${e.method === "GET" ? "bg-[#e5efff] text-deep" : "bg-success-soft text-success"}`}>{e.method}</span>
                  <code className="font-mono text-[14px] font-semibold">{e.path}</code>
                  <span className="text-[14px] text-muted">{e.summary}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/api/v1/openapi.json" target="_blank" className={buttonClass("secondary", "sm")}>
                <FileJson size={15} /> openapi.json
              </a>
              <a href="/api/v1/postman.json" className={buttonClass("secondary", "sm")}>
                <Send size={15} /> Postman collection
              </a>
            </div>
          </section>
          <Keys apps={data.apps} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="card p-6">
            <Plug className="text-blue" />
            <h3 className="mt-3 font-display text-[20px] font-bold">MCP server</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">Any MCP-capable agent can attribute recommendations with no custom code. Tools: <code className="kbd">search_sources</code>, <code className="kbd">attribute_recommendation</code>, <code className="kbd">get_attribution</code>, <code className="kbd">get_creator_earnings</code>.</p>
            <button onClick={() => setLang("mcp")} className="mt-4 text-[14px] font-semibold text-blue hover:underline">
              Show MCP config ↑
            </button>
          </section>
          <section className="card p-6">
            <Boxes className="text-blue" />
            <h3 className="mt-3 font-display text-[20px] font-bold">SDKs from the spec</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">The OpenAPI 3.1 spec is the single source of truth. Import it into APIMatic to generate typed SDKs and a docs portal for TypeScript, Python, Java, C#, Go, PHP and Ruby.</p>
            <a href="/api/v1/openapi.json" target="_blank" className="mt-4 inline-block text-[14px] font-semibold text-blue hover:underline">
              Download spec →
            </a>
          </section>
          <section className="card p-6">
            <Webhook className="text-blue" />
            <h3 className="mt-3 font-display text-[20px] font-bold">PayPal webhooks we consume</h3>
            <ul className="mt-2 space-y-1.5 font-mono text-[12.5px] text-[#3c4043]">
              <li>PAYMENT.CAPTURE.COMPLETED</li>
              <li>PAYMENT.CAPTURE.REFUNDED</li>
              <li>PAYMENT.PAYOUTS-ITEM.SUCCEEDED</li>
              <li>PAYMENT.PAYOUTS-ITEM.UNCLAIMED</li>
              <li>PAYMENT.PAYOUTS-ITEM.FAILED</li>
            </ul>
            <p className="mt-2 text-[13px] text-muted">Signature-verified and idempotent by event ID.</p>
          </section>
        </div>
      </div>
    </>
  );
}

function Playground({ data, apiKey }: { data: DevData; apiKey: string }) {
  const router = useRouter();
  const [product, setProduct] = useState("p_aura_one");
  const relevant = data.sources.filter((s) => s.productIds.includes(product));
  const [picked, setPicked] = useState<string[]>(() => data.sources.filter((s) => s.productIds.includes("p_aura_one")).slice(0, 2).map((s) => s.id));
  const [query, setQuery] = useState("noise cancelling headphones for flights");
  const [res, setRes] = useState<{ status: number; body: unknown } | null>(null);
  const [busy, setBusy] = useState<"attr" | "buy" | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);

  const body = {
    query,
    answer: `I recommend the ${data.products.find((p) => p.id === product)?.title}${picked.map((_, i) => ` [${i + 1}]`).join("")}.`,
    product_ids: [product],
    citations: picked.map((id) => ({ source_id: id, claim: data.sources.find((s) => s.id === id)?.title ?? "", product_ids: [product] })),
  };

  async function send() {
    setBusy("attr");
    setSaleId(null);
    const r = await fetch("/api/v1/attributions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
    setRes({ status: r.status, body: await r.json() });
    setBusy(null);
  }
  async function buy() {
    const token = (res?.body as { token?: string })?.token;
    if (!token) return;
    setBusy("buy");
    const r = await fetch("/api/checkout/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, productId: product }) });
    const j = await r.json();
    setBusy(null);
    if (r.ok) {
      setSaleId(j.saleId);
      router.refresh();
    }
  }

  return (
    <section id="playground" className="scroll-mt-24 rounded-[28px] bg-mist p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Live playground</p>
          <h2 className="mt-2 font-display text-[28px] font-bold">Call the real API against this sandbox</h2>
        </div>
        <Pill tone="sky">Using key {apiKey.slice(0, 16)}…</Pill>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl bg-white p-5">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Shopper query</span>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-muted">Recommended product</span>
            <select
              className="input"
              value={product}
              onChange={(e) => {
                setProduct(e.target.value);
                setPicked(data.sources.filter((s) => s.productIds.includes(e.target.value)).slice(0, 2).map((s) => s.id));
                setRes(null);
              }}
            >
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-muted">Sources your agent cited</legend>
            <div className="space-y-2">
              {relevant.map((s) => {
                const on = picked.includes(s.id);
                return (
                  <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 ring-1 transition ${on ? "bg-sky-soft ring-blue" : "ring-line hover:ring-ink"}`}>
                    <input type="checkbox" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== s.id) : [...picked, s.id])} className="h-4 w-4 accent-[#0070E0]" />
                    <span className="min-w-0 text-[14px]">
                      <span className="font-semibold">{s.creator}</span> <span className="text-muted">· {s.title}</span>
                    </span>
                  </label>
                );
              })}
              {!relevant.length && <p className="text-[14px] text-muted">No registered sources for this product yet.</p>}
            </div>
          </fieldset>
          <Button onClick={send} disabled={!picked.length || busy !== null} className="w-full">
            <Play size={16} /> {busy === "attr" ? "Sending…" : "POST /v1/attributions"}
          </Button>
        </div>
        <div className="min-w-0 space-y-3">
          <pre className="code-block max-h-[220px] text-[12px]">{`POST /api/v1/attributions\nAuthorization: Bearer ${apiKey.slice(0, 16)}…\n\n${JSON.stringify(body, null, 2)}`}</pre>
          <pre className="code-block max-h-[300px] text-[12px]">{res ? `HTTP ${res.status}\n\n${JSON.stringify(res.body, null, 2)}` : "// Response appears here"}</pre>
          {res && res.status === 201 && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4">
              <p className="flex-1 text-[14px]">Token issued. Simulate a captured PayPal payment with it to run scoring, risk and the split.</p>
              {saleId ? (
                <Link href={`/attribution/${saleId}`} className={buttonClass("primary", "sm")}>
                  Open trace <ArrowRight size={15} />
                </Link>
              ) : (
                <Button size="sm" variant="gold" onClick={buy} disabled={busy !== null}>
                  {busy === "buy" ? "Capturing…" : "Simulate purchase"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Keys({ apps }: { apps: DevData["apps"] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await fetch("/api/apps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setBusy(false);
    setName("");
    router.refresh();
  }
  return (
    <section className="card h-fit p-6">
      <h2 className="flex items-center gap-2 font-display text-[22px] font-bold">
        <KeyRound size={20} className="text-blue" /> Sandbox API keys
      </h2>
      <ul className="mt-4 space-y-2.5">
        {apps.map((a) => (
          <li key={a.id} className="rounded-xl bg-cloud p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{a.name}</p>
              <span className="text-[12.5px] text-muted">{a.requests.toLocaleString()} requests</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[#3c4043]">{a.apiKey}</code>
              <CopyButton text={a.apiKey} dark={false} />
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="mt-4 flex gap-2">
        <label htmlFor="appname" className="sr-only">
          App name
        </label>
        <input id="appname" className="input" placeholder="New app name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <Button type="submit" disabled={busy || !name.trim()}>
          Create
        </Button>
      </form>
      <p className="mt-2 text-[12px] text-subtle">Sandbox keys only. Production keys would be issued through the PayPal developer dashboard.</p>
    </section>
  );
}

function CopyButton({ text, className = "", dark = true }: { text: string; className?: string; dark?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${dark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-mist"} ${className}`}
      aria-label="Copy"
    >
      {done ? <Check size={14} /> : <Copy size={14} />} <span className="hidden sm:inline">{done ? "Copied" : "Copy"}</span>
    </button>
  );
}

function buildSnippets(base: string, key: string): Record<Lang, string> {
  return {
    ts: `// 1. Your agent answered. Register what it cited.
const att = await fetch("${base}/api/v1/attributions", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${key}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: "noise cancelling headphones under $150",
    answer: "Get the Sonora Aura One [1]. Measured 31 dB of ANC [2].",
    product_ids: ["p_aura_one"],
    citations: [
      { source_id: "src_maya_aura_review", claim: "Best ANC on a commute" },
      { source_url: "https://thegearlab.example/anc-measurements" },
    ],
  }),
}).then((r) => r.json());

// Render att.footnotes under your answer.

// 2. Create the PayPal order with the token as custom_id.
await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
  method: "POST",
  headers: { Authorization: \`Bearer \${paypalAccessToken}\`, "Content-Type": "application/json" },
  body: JSON.stringify({
    intent: "CAPTURE",
    purchase_units: [{
      custom_id: att.token,            // ← that's the whole integration
      amount: { currency_code: "USD", value: "149.00" },
    }],
  }),
});

// 3. Done. Creators are paid via PayPal Payouts after capture.`,
    py: `import requests

API = "${base}/api/v1"
HEADERS = {"Authorization": "Bearer ${key}"}

# 1. Register the sources behind your agent's answer
att = requests.post(f"{API}/attributions", headers=HEADERS, json={
    "query": "noise cancelling headphones under $150",
    "answer": "Get the Sonora Aura One [1]. Measured 31 dB of ANC [2].",
    "product_ids": ["p_aura_one"],
    "citations": [
        {"source_id": "src_maya_aura_review", "claim": "Best ANC on a commute"},
        {"source_url": "https://thegearlab.example/anc-measurements"},
    ],
}).json()

for f in att["footnotes"]:
    print(f"[{f['n']}] {f['creator']}: {f['title']}")

# 2. Pass att["token"] as purchase_units[0].custom_id on your PayPal order.

# 3. Later: see how the sale was split
sale = requests.get(f"{API}/attributions/{att['token']}", headers=HEADERS).json()`,
    curl: `curl -X POST ${base}/api/v1/attributions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "noise cancelling headphones under $150",
    "product_ids": ["p_aura_one"],
    "citations": [
      { "source_id": "src_maya_aura_review", "claim": "Best ANC on a commute" },
      { "source_id": "src_noor_anc_lab", "claim": "31 dB measured" }
    ]
  }'

# Search citable creator content
curl "${base}/api/v1/sources?q=noise+cancelling" \\
  -H "Authorization: Bearer ${key}"`,
    mcp: `// MCP client config (e.g. mcp.json / your agent's MCP settings)
{
  "mcpServers": {
    "paypal-attribute": {
      "command": "node",
      "args": ["mcp/server.mjs"],
      "env": {
        "ATTRIBUTE_API_URL": "${base}/api/v1",
        "ATTRIBUTE_API_KEY": "${key}"
      }
    }
  }
}

// Tools exposed to the agent:
//   search_sources            find creator content to cite
//   attribute_recommendation  register citations → token + footnotes
//   get_attribution           sales + split for a token
//   get_creator_earnings      earnings summary for a creator`,
  };
}
