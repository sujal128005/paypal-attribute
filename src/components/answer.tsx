"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Avatar } from "./ui";

export interface FootnoteView {
  n: number;
  source_id: string;
  creator: string;
  handle: string;
  color: string;
  title: string;
  url: string;
  kind: string;
  excerpt: string;
  claim: string;
  creator_id?: string;
  product_ids?: string[];
}

/** Renders an agent answer: paragraphs, **bold**, and [n] markers as interactive footnotes. */
export function AnswerText({ text, footnotes }: { text: string; footnotes: FootnoteView[] }) {
  return (
    <div className="space-y-3 text-[15.5px] leading-[1.65] text-[#1f2328]">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>{renderInline(para, footnotes)}</p>
      ))}
    </div>
  );
}

function renderInline(para: string, footnotes: FootnoteView[]): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[\d+\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(para))) {
    if (m.index > last) out.push(para.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={k++} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>);
    else {
      const n = Number(tok.slice(1, -1));
      const f = footnotes.find((x) => x.n === n);
      out.push(f ? <FootnoteChip key={k++} f={f} /> : null);
    }
    last = m.index + tok.length;
  }
  if (last < para.length) out.push(para.slice(last));
  return out;
}

function FootnoteChip({ f }: { f: FootnoteView }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="footnote-chip mx-0.5" aria-label={`Source ${f.n}: ${f.title} by ${f.creator}`} onClick={() => setOpen((v) => !v)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        {f.n}
      </button>
      {open && (
        <span role="tooltip" className="absolute bottom-[calc(100%+8px)] left-1/2 z-30 block w-[min(320px,80vw)] -translate-x-1/2 rounded-2xl border border-line bg-white p-4 text-left text-[13.5px] leading-snug shadow-[var(--shadow-lift)]">
          <span className="flex items-center gap-2.5">
            <Avatar name={f.creator} color={f.color} size={28} />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{f.creator}</span>
              <span className="block truncate text-[12px] text-muted">
                {f.handle} · {f.kind}
              </span>
            </span>
          </span>
          <span className="mt-2.5 block font-semibold text-ink">{f.title}</span>
          <span className="mt-1 block text-muted">&ldquo;{f.excerpt}&rdquo;</span>
          <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-blue">
            <ExternalLink size={12} /> {f.url.replace(/^https?:\/\//, "")}
          </span>
        </span>
      )}
    </span>
  );
}

export function FootnoteList({ footnotes }: { footnotes: FootnoteView[] }) {
  if (!footnotes.length) return null;
  return (
    <ol className="mt-4 space-y-2 border-t border-line pt-4">
      {footnotes.map((f) => (
        <li key={f.n} className="flex items-start gap-2.5 text-[13px] leading-snug">
          <span className="footnote-chip mt-[3px] translate-y-0">{f.n}</span>
          <span className="min-w-0">
            <span className="font-semibold text-ink">{f.creator}</span> <span className="text-muted">· {f.title}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
