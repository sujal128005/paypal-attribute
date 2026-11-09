"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, RotateCcw, X } from "lucide-react";
import { buttonClass, Mark } from "./ui";

const NAV = [
  { href: "/shop", label: "Shop with AI" },
  { href: "/attribution", label: "Sale attribution" },
  { href: "/merchants", label: "Merchants" },
  { href: "/creators", label: "Creators" },
  { href: "/developers", label: "Developers" },
  { href: "/risk", label: "Risk" },
];

export function SiteHeader() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function reset() {
    if (!confirm("Reset all demo data to the starting state?")) return;
    setResetting(true);
    await fetch("/api/demo/reset", { method: "POST" });
    setResetting(false);
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur-md">
      <div className="container-page flex h-[72px] items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="PayPal Attribute home">
          <Mark />
          <span className="font-display text-[19px] font-extrabold tracking-[-0.03em]">
            PayPal <span className="text-blue">Attribute</span>
          </span>
        </Link>
        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3.5 py-2 text-[15px] font-semibold transition ${active ? "bg-[rgba(5,55,130,0.08)] text-ink" : "text-[#2c2e2f] hover:bg-cloud"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <button onClick={reset} disabled={resetting} className={buttonClass("ghost", "sm")} title="Reset demo data">
            <RotateCcw size={15} /> {resetting ? "Resetting…" : "Reset demo"}
          </button>
          <Link href="/shop" className={buttonClass("primary", "sm")}>
            Try the demo
          </Link>
        </div>
        <button className="ml-auto rounded-full p-2 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-white lg:hidden">
          <nav className="container-page flex flex-col py-3" aria-label="Mobile">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-[16px] font-semibold hover:bg-cloud">
                {n.label}
              </Link>
            ))}
            <button onClick={reset} className="rounded-xl px-3 py-3 text-left text-[16px] font-semibold text-muted hover:bg-cloud">
              Reset demo data
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
