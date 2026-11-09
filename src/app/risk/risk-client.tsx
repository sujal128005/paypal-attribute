"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, Ban, Copy, FileWarning, Gauge, ShieldAlert, Zap } from "lucide-react";
import { Time } from "@/components/time";
import { Avatar, Button, EmptyState, PageHeader, Pill, Stat, StatusPill } from "@/components/ui";
import type { RiskFlag } from "@/lib/types";

export type RiskRow = RiskFlag & { creator: { name: string; color: string } | null; saleTitle: string | null; sourceTitle: string | null; sourceExcerpt: string | null };

const KIND: Record<RiskFlag["kind"], { label: string; icon: typeof Ban; explain: string }> = {
  prompt_injection: { label: "Prompt injection", icon: Ban, explain: "Content tried to instruct AI agents. It never earns." },
  content_screening: { label: "Content screening", icon: FileWarning, explain: "Flagged when the content was registered." },
  self_dealing: { label: "Self-dealing", icon: Copy, explain: "A creator bought through their own citation." },
  citation_stuffing: { label: "Citation stuffing", icon: Zap, explain: "One creator cited many times in one answer, so the citations were collapsed into one share." },
  budget_cap: { label: "Budget cap", icon: Gauge, explain: "Commission would exceed the merchant's monthly cap." },
  velocity: { label: "Velocity", icon: ShieldAlert, explain: "Unusual repeat purchases. Payouts held until reviewed." },
};

export function RiskClient({ rows, stats }: { rows: RiskRow[]; stats: { open: number; blockedSources: number; excluded: number; reviewed: number } & Record<string, number> }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"open" | "all">(stats.open ? "open" : "all");
  const [busy, setBusy] = useState<string | null>(null);
  const shown = rows.filter((r) => filter === "all" || r.status === "open");

  async function act(id: string, action: "approve" | "confirm" | "dismiss") {
    setBusy(id);
    await fetch(`/api/risk/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="container-page">
      <PageHeader eyebrow="Risk & trust" title="Money only moves when the evidence holds up." description="Every captured sale passes six automated checks before commission is allocated. Anything unusual lands here for a human decision, and payouts wait until it's resolved." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat accent label="Open for review" value={stats.open} hint="Payouts held until resolved" />
        <Stat label="Sources blocked" value={stats.blockedSources} hint="Injected or manipulative content" />
        <Stat label="Shares excluded" value={stats.excluded} hint="Self-dealing or blocked sources" />
        <Stat label="Decisions made" value={stats.reviewed} hint="Auto-confirmed or reviewed" />
      </div>

      <div className="mb-4 mt-10 flex items-center justify-between gap-3">
        <h2 className="font-display text-[22px] font-bold">Review queue</h2>
        <div className="flex rounded-full bg-cloud p-1" role="tablist">
          {(["open", "all"] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-1.5 text-[14px] font-semibold transition ${filter === f ? "bg-white shadow-sm" : "text-muted"}`}>
              {f === "open" ? `Open (${stats.open})` : `All (${rows.length})`}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Nothing waiting for review" body="Every flagged sale and source has a decision. New signals appear here as they happen." />
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const k = KIND[r.kind];
            const Icon = k.icon;
            return (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${r.severity === "high" ? "bg-danger-soft text-danger" : r.severity === "medium" ? "bg-warn-soft text-warn" : "bg-mist text-muted"}`}>
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{k.label}</p>
                      <Pill tone={r.severity === "high" ? "danger" : r.severity === "medium" ? "warn" : "neutral"}>{r.severity}</Pill>
                      <StatusPill status={r.status} />
                      <span className="text-[12.5px] text-subtle">
                        <Time iso={r.createdAt} mode="relative" />
                      </span>
                    </div>
                    <p className="mt-1 text-[14.5px] text-[#3c4043]">{r.message}</p>
                    <p className="mt-1 text-[13px] text-muted">{k.explain}</p>
                    {r.sourceExcerpt && r.kind !== "self_dealing" && <p className="mt-2 rounded-xl bg-cloud px-3.5 py-2.5 font-mono text-[12.5px] text-[#3c4043]">&ldquo;{r.sourceExcerpt}&rdquo;</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
                      {r.creator && (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={r.creator.name} color={r.creator.color} size={20} /> {r.creator.name}
                        </span>
                      )}
                      {r.saleId && (
                        <Link href={`/attribution/${r.saleId}`} className="font-semibold text-blue hover:underline">
                          Open sale trace →
                        </Link>
                      )}
                    </div>
                  </div>
                  {r.status === "open" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => act(r.id, r.saleId ? "approve" : "dismiss")}>
                        <BadgeCheck size={15} /> {r.saleId ? "Approve payouts" : "Allow"}
                      </Button>
                      <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, "confirm")}>
                        <Ban size={15} /> Confirm fraud
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
