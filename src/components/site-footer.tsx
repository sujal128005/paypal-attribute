import Link from "next/link";
import { Mark } from "./ui";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-cloud">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="font-display text-[18px] font-extrabold tracking-[-0.03em]">
              PayPal <span className="text-blue">Attribute</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-muted">
            The payment rail for AI shopping. Every recommendation cites its sources, and every source gets paid through PayPal.
          </p>
        </div>
        {[
          { h: "Product", l: [["Shop with AI", "/shop"], ["Sale attribution", "/attribution"], ["Risk & trust", "/risk"]] },
          { h: "For", l: [["Merchants", "/merchants"], ["Creators", "/creators"], ["Developers", "/developers"]] },
          { h: "API", l: [["OpenAPI spec", "/api/v1/openapi.json"], ["Postman collection", "/api/v1/postman.json"], ["Status", "/api/status"]] },
        ].map((col) => (
          <div key={col.h}>
            <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-subtle">{col.h}</p>
            <ul className="mt-4 space-y-2.5">
              {col.l.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-[15px] font-medium text-ink hover:text-blue">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="container-page py-6 text-[12.5px] leading-relaxed text-subtle">
          Hackathon prototype proposed for the PayPal developer platform. Not an official PayPal product and not affiliated with or endorsed by PayPal. Payments run in the PayPal sandbox: no real money moves. All merchants, products and creators shown are fictional.
        </p>
      </div>
    </footer>
  );
}
