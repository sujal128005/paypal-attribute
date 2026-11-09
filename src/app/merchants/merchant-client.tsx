"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { ArrowUp, Download, Search, Settings2, Sparkles } from "lucide-react";
import { Chart, DataGrid } from "@/components/grid";
import { Button, PageHeader, Pill, Stat, StatusPill } from "@/components/ui";
import type { Merchant } from "@/lib/types";
import { usd } from "@/lib/util";

export interface MerchantData {
  merchants: { id: string; name: string; color: string }[];
  merchant: Merchant;
  rows: { id: string; date: string; product: string; query: string; amount: number; commission: number; creators: string; topCreator: string; sources: number; engine: string; risk: string; status: string; mode: string }[];
  days: { day: string; revenue: number; commission: number }[];
  creators: { creator: string; earned: number; revenue: number; color: string }[];
  kpis: { revenue: number; commission: number; roc: number; orders: number; refunds: number; monthCommission: number };
}

const money = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD" });
const dollars = ({ value }: { value: unknown }) => `$${Number(value).toLocaleString("en-US")}`;

export function MerchantClient({ data }: { data: MerchantData }) {
  const router = useRouter();
  const gridRef = useRef<AgGridReact>(null);
  const [quick, setQuick] = useState("");
  const m = data.merchant;
  const budgetUsed = Math.min(1, (data.kpis.monthCommission * 100) / m.monthlyBudget);

  const columns = useMemo<ColDef<MerchantData["rows"][number]>[]>(
    () => [
      { field: "date", headerName: "Date", width: 130, sort: "desc", valueFormatter: (p) => new Date(p.value).toLocaleDateString("en-US", { month: "short", day: "numeric" }), filter: "agDateColumnFilter", filterValueGetter: (p) => new Date(p.data!.date) },
      { field: "product", headerName: "Product", flex: 1.2, minWidth: 180, filter: true, cellClass: "font-semibold" },
      { field: "query", headerName: "Shopper asked", flex: 1.6, minWidth: 220, filter: true, tooltipField: "query", cellStyle: { color: "#595959" } },
      { field: "amount", headerName: "Sale", width: 110, type: "rightAligned", valueFormatter: (p) => money(p.value), filter: "agNumberColumnFilter" },
      { field: "commission", headerName: "Commission", width: 130, type: "rightAligned", valueFormatter: (p) => money(p.value), filter: "agNumberColumnFilter" },
      { field: "creators", headerName: "Creators paid", flex: 1.3, minWidth: 190, filter: true },
      { field: "sources", headerName: "Sources", width: 105, type: "rightAligned" },
      { field: "engine", headerName: "Scored by", width: 115, valueFormatter: (p) => (p.value === "ai" ? "AI" : "Rules"), filter: true },
      { field: "status", headerName: "Status", width: 130, filter: true, cellRenderer: (p: ICellRendererParams) => <StatusPill status={p.data.risk === "review" && p.value === "captured" ? "review" : p.value} /> },
    ],
    [],
  );

  return (
    <div className="container-page">
      <PageHeader
        eyebrow="Merchant dashboard"
        title={`${m.name}: AI-attributed sales`}
        description="See which AI conversations and which creators drive your sales. You pay commission only when a cited creator actually influenced a purchase."
      />

      <nav className="-mt-2 mb-8 flex flex-wrap gap-2" aria-label="Choose merchant">
        {data.merchants.map((x) => (
          <Link
            key={x.id}
            href={`/merchants?merchant=${x.id}`}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold transition ${x.id === m.id ? "bg-ink text-white" : "bg-cloud text-ink hover:bg-mist"}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} /> {x.name}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label="AI-attributed revenue" value={money(data.kpis.revenue)} hint={`${data.kpis.orders} orders · ${data.kpis.refunds} refunded`} />
        <Stat label="Commission paid" value={money(data.kpis.commission)} hint={`${Math.round(m.commissionRate * 100)}% on attributed sales only`} />
        <Stat label="Return on commission" value={`${data.kpis.roc.toFixed(1)}×`} hint="Revenue per $1 of commission" />
        <div className="card p-5">
          <p className="text-[13px] font-semibold text-muted">Monthly budget</p>
          <p className="mt-2 font-display text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums">{Math.round(budgetUsed * 100)}%</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist">
            <div className="h-full rounded-full bg-blue" style={{ width: `${budgetUsed * 100}%` }} />
          </div>
          <p className="mt-2 text-[13px] text-muted">
            {money(data.kpis.monthCommission)} of {usd(m.monthlyBudget)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[19px] font-bold">AI-attributed revenue, last 30 days</h2>
          </div>
          <Chart
            height={260}
            options={{
              data: data.days,
              series: [
                { type: "bar", xKey: "day", yKey: "revenue", yName: "Revenue", fill: "#0070E0", cornerRadius: 4 },
              ],
              axes: {
                x: { type: "category", position: "bottom", label: { autoRotate: false }, line: { enabled: false } },
                y: { type: "number", position: "left", label: { formatter: dollars }, gridLine: { style: [{ stroke: "#EDF0F2" }] } },
              },
            }}
          />
        </section>
        <section className="card p-6">
          <h2 className="font-display text-[19px] font-bold">Revenue influenced, by creator</h2>
          {data.creators.length ? (
            <Chart
              height={260}
              options={{
                data: data.creators.slice(0, 6),
                series: [{ type: "bar", direction: "horizontal", xKey: "creator", yKey: "revenue", yName: "Influenced revenue", fill: "#60CDFF", stroke: "#0070E0", cornerRadius: 4 }],
                axes: {
                  x: { type: "category", position: "left", line: { enabled: false } },
                  y: { type: "number", position: "bottom", label: { formatter: dollars }, gridLine: { style: [{ stroke: "#EDF0F2" }] } },
                },
              }}
            />
          ) : (
            <p className="mt-6 text-muted">No creator-attributed sales yet.</p>
          )}
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[22px] font-bold">Attributed orders</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 focus-within:border-ink">
              <Search size={16} className="text-subtle" />
              <span className="sr-only">Search orders</span>
              <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Search orders, creators, queries" className="w-[220px] bg-transparent text-[14px] outline-none" />
            </label>
            <Button variant="secondary" size="sm" onClick={() => gridRef.current?.api.exportDataAsCsv({ fileName: `${m.id}-attributed-orders.csv` })}>
              <Download size={15} /> Export CSV
            </Button>
          </div>
        </div>
        <div style={{ height: 520 }}>
          <DataGrid
            ref={gridRef}
            rowData={data.rows}
            columnDefs={columns}
            quickFilterText={quick}
            pagination
            paginationPageSize={10}
            paginationPageSizeSelector={[10, 25, 50]}
            defaultColDef={{ sortable: true, resizable: true }}
            onRowClicked={(e) => e.data && router.push(`/attribution/${e.data.id}`)}
            rowStyle={{ cursor: "pointer" }}
            tooltipShowDelay={300}
          />
        </div>
        <p className="mt-2 text-[13px] text-subtle">Click any order to open its full attribution trace.</p>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Insights merchantId={m.id} />
        <SettingsCard merchant={m} />
      </div>
    </div>
  );
}

function Insights({ merchantId }: { merchantId: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ q: string; a: string; engine: string; provider?: string } | null>(null);
  async function ask(question: string) {
    if (!question.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/merchants/${merchantId}/insights`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
    const json = await res.json();
    setAnswer({ q: question, a: res.ok ? json.answer : json.error?.message ?? "Could not answer", engine: json.engine, provider: json.provider });
    setBusy(false);
    setQ("");
  }
  return (
    <section className="rounded-[var(--radius-card)] bg-sky-soft p-6">
      <h2 className="flex items-center gap-2 font-display text-[20px] font-bold">
        <Sparkles size={20} className="text-blue" /> Ask about your AI sales
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {["Which creator drives the most sales?", "Is my commission worth it?", "Which product sells best through AI?", "How are refunds affecting me?"].map((s) => (
          <button key={s} onClick={() => ask(s)} disabled={busy} className="rounded-full bg-white px-3.5 py-2 text-[13.5px] font-medium ring-1 ring-line transition hover:ring-ink disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      <form
        className="mt-4 flex items-center gap-2 rounded-full bg-white py-1.5 pl-5 pr-1.5 ring-1 ring-line focus-within:ring-ink"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <label htmlFor="insight" className="sr-only">
          Ask a question
        </label>
        <input id="insight" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything about your attributed sales" className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none" />
        <button type="submit" disabled={busy || !q.trim()} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white disabled:opacity-30" aria-label="Ask">
          <ArrowUp size={17} />
        </button>
      </form>
      {busy && <p className="mt-4 text-[14px] text-deep">Analysing your sales…</p>}
      {answer && !busy && (
        <div className="animate-rise mt-4 rounded-2xl bg-white p-5">
          <p className="text-[13px] font-semibold text-muted">{answer.q}</p>
          <p className="mt-2 leading-relaxed">{answer.a}</p>
          <p className="mt-3 text-[12px] text-subtle">{answer.engine === "ai" ? `AI analysis (${answer.provider ?? "AI"}) of your attribution data` : "Computed by the built-in rules from your attribution data"}</p>
        </div>
      )}
    </section>
  );
}

function SettingsCard({ merchant }: { merchant: Merchant }) {
  const router = useRouter();
  const [form, setForm] = useState({
    commission: merchant.commissionRate * 100,
    budget: merchant.monthlyBudget / 100,
    hold: merchant.holdMinutes,
    min: merchant.minShare * 100,
    max: merchant.maxShare * 100,
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    const res = await fetch(`/api/merchants/${merchant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionRate: form.commission / 100, monthlyBudget: Math.round(form.budget * 100), holdMinutes: form.hold, minShare: form.min / 100, maxShare: form.max / 100 }),
    });
    setState(res.ok ? "saved" : "error");
    if (res.ok) router.refresh();
  }
  const field = (key: keyof typeof form, label: string, suffix: string, step = 1, hint?: string) => (
    <label className="block">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="mt-1.5 flex items-center rounded-xl border border-line px-3.5 focus-within:border-ink">
        <input type="number" step={step} value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className="w-full bg-transparent py-2.5 text-[15px] font-semibold outline-none" />
        <span className="text-[13px] text-subtle">{suffix}</span>
      </span>
      {hint && <span className="mt-1 block text-[12px] text-subtle">{hint}</span>}
    </label>
  );
  return (
    <form onSubmit={save} className="card p-6">
      <h2 className="flex items-center gap-2 font-display text-[20px] font-bold">
        <Settings2 size={20} className="text-blue" /> Attribution rules
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {field("commission", "Commission on AI-attributed sales", "%", 0.5)}
        {field("budget", "Monthly commission cap", "USD", 50)}
        {field("hold", "Payout hold (return window)", "min", 1, "Demo uses minutes; production uses your return policy in days.")}
        {field("min", "Minimum creator share", "%", 1, "Trivial mentions below this earn nothing.")}
        {field("max", "Maximum creator share", "%", 5, "No single creator takes the whole pool.")}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Button type="submit" disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save rules"}
        </Button>
        {state === "saved" && <Pill tone="success">Saved. Applies to new sales.</Pill>}
        {state === "error" && <Pill tone="danger">Check the values and try again</Pill>}
      </div>
    </form>
  );
}
