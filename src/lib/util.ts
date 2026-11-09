import type { Cents } from "./types";

export const usd = (cents: Cents, opts: { sign?: boolean } = {}) => {
  const v = cents / 100;
  const s = v.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return opts.sign && cents > 0 ? `+${s}` : s;
};

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export const toCents = (dollars: number): Cents => Math.round(dollars * 100);

export function randomId(prefix: string, len = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${prefix}_${out}`;
}

export function apiKey() {
  return randomId("pa_test", 28).toLowerCase().replace("pa_test_", "pa_test_");
}

/** Mulberry32 — small deterministic PRNG for reproducible seed data. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function relativeTime(iso: string, now = Date.now()) {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9$ ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

const STOP = new Set(
  "the and for with that this you your are was but not have has had from they them their what when where which who will would can could should about into over under than then there here very just also more most best good great some any all our out its it's".split(
    " ",
  ),
);

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
