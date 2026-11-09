import type { Metadata, Viewport } from "next";
import "@fontsource-variable/outfit";
import "@fontsource-variable/inter";
// Precompiled from globals.css with `npm run css`, so no CSS tooling runs at dev/build time.
import "./styles.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: { default: "PayPal Attribute: get paid when AI recommends you", template: "%s · PayPal Attribute" },
  description:
    "An attribution and payout rail for AI-driven commerce. AI agents cite their sources, shoppers pay with PayPal, and the creators who influenced the sale are paid automatically.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
