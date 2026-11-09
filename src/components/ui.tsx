import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Coffee, Camera, Footprints, Headphones, House, Luggage, type LucideIcon } from "lucide-react";
import type { Category } from "@/lib/types";
import { initials } from "@/lib/util";

type Variant = "primary" | "secondary" | "ghost" | "gold" | "blue" | "inverse";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#262626]",
  secondary: "bg-[rgba(5,55,130,0.08)] text-ink hover:bg-[rgba(5,55,130,0.14)]",
  ghost: "text-ink hover:bg-cloud",
  gold: "bg-gold text-navy hover:bg-gold-hover",
  blue: "bg-blue text-white hover:bg-blue-hover",
  inverse: "bg-white text-ink hover:bg-sky-soft",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[14px]",
  md: "h-11 px-6 text-[15px]",
  lg: "h-13 px-8 text-[16px]",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra = "") =>
  `inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold tracking-[-0.01em] transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${extra}`;

export function Button({ variant, size, className = "", ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...rest} />;
}

export function LinkButton({ variant, size, className = "", ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

type Tone = "neutral" | "blue" | "success" | "warn" | "danger" | "sky" | "ink";
const tones: Record<Tone, string> = {
  neutral: "bg-mist text-[#3c4043]",
  blue: "bg-[#e5efff] text-deep",
  sky: "bg-sky-soft text-deep",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  ink: "bg-ink text-white",
};

export function Pill({ tone = "neutral", children, className = "", dot = false }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none ${tones[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const statusTone = (s: string): Tone =>
  (({
    sent: "success",
    captured: "success",
    approved: "success",
    active: "success",
    converted: "success",
    held: "warn",
    review: "warn",
    flagged: "warn",
    released: "blue",
    open: "blue",
    created: "neutral",
    reversed: "neutral",
    dismissed: "neutral",
    refunded: "danger",
    failed: "danger",
    blocked: "danger",
    confirmed: "danger",
  }) as Record<string, Tone>)[s] ?? "neutral";

export const statusLabel = (s: string) =>
  ({ sent: "Paid", held: "On hold", released: "Sending", reversed: "Reversed", captured: "Captured", refunded: "Refunded", created: "Pending", review: "In review", approved: "Approved", blocked: "Blocked", flagged: "Flagged", active: "Active", open: "Open", converted: "Converted", confirmed: "Confirmed", dismissed: "Dismissed", failed: "Failed" })[s] ?? s;

export function StatusPill({ status }: { status: string }) {
  return (
    <Pill tone={statusTone(status)} dot>
      {statusLabel(status)}
    </Pill>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-[var(--radius-card)] p-5 ${accent ? "bg-navy text-white" : "card"}`}>
      <p className={`text-[13px] font-semibold ${accent ? "text-sky" : "text-muted"}`}>{label}</p>
      <p className={`mt-2 font-display text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums ${accent ? "text-white" : "text-ink"}`}>{value}</p>
      {hint && <p className={`mt-2 text-[13px] ${accent ? "text-white/70" : "text-muted"}`}>{hint}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 pb-8 pt-10 md:flex-row md:items-end md:justify-between md:pt-14">
      <div className="max-w-3xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="display-lg">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

const CATEGORY_ICON: Record<Category, LucideIcon> = { audio: Headphones, running: Footprints, coffee: Coffee, camera: Camera, home: House, travel: Luggage };
const CATEGORY_BG: Record<Category, string> = {
  audio: "linear-gradient(135deg,#60cdff 0%,#0070e0 100%)",
  running: "linear-gradient(135deg,#7fe0c3 0%,#0e7c66 100%)",
  coffee: "linear-gradient(135deg,#ffd9a8 0%,#9a4a1c 100%)",
  camera: "linear-gradient(135deg,#c9d3e3 0%,#1f2937 100%)",
  home: "linear-gradient(135deg,#d4f1e8 0%,#2b8a6e 100%)",
  travel: "linear-gradient(135deg,#ffd0b8 0%,#b4542f 100%)",
};

export function ProductArt({ category, imageUrl, size = 64, className = "" }: { category: Category; imageUrl?: string; size?: number; className?: string }) {
  const Icon = CATEGORY_ICON[category];
  if (imageUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={`shrink-0 rounded-2xl bg-cloud object-cover ${className}`} style={{ width: size, height: size }} />;
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-2xl text-white ${className}`} style={{ width: size, height: size, background: CATEGORY_BG[category] }}>
      <Icon size={size * 0.42} strokeWidth={1.8} />
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card-flat flex flex-col items-center px-6 py-14 text-center">
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="mt-2 max-w-md text-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Mark({ size = 30 }: { size?: number }) {
  // Our own mark: a footnote marker inside a rounded tile.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#001c64" />
      <path d="M9 22.5 13.6 9.5h2.6l4.6 13h-2.7l-1-3h-4.6l-1 3H9Zm4.3-5.2h3.2l-1.6-4.9-1.6 4.9Z" fill="#fff" />
      <circle cx="23.3" cy="10" r="3.2" fill="#60cdff" />
    </svg>
  );
}
