import type { Metadata } from "next";
import { aiConfigured, aiLabel } from "@/lib/ai";
import { channel3Configured } from "@/lib/channel3";
import { paypalClientId, paypalConfigured } from "@/lib/paypal";
import { ShopClient } from "./shop-client";

export const metadata: Metadata = { title: "Shop with AI" };
export const dynamic = "force-dynamic";

export default function ShopPage() {
  return (
    <ShopClient
      config={{
        paypal: paypalConfigured(),
        clientId: paypalConfigured() ? paypalClientId() : "",
        ai: aiConfigured(),
        aiLabel: aiLabel() ?? "",
        channel3: channel3Configured(),
      }}
    />
  );
}
