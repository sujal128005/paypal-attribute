import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { releaseDuePayouts } from "@/lib/engine";
import { paypalConfigured } from "@/lib/paypal";
import { saleDetail } from "@/lib/views";
import { TraceClient } from "./trace-client";

export const metadata: Metadata = { title: "Attribution trace" };
export const dynamic = "force-dynamic";

export default async function TracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await releaseDuePayouts({ saleId: id });
  const detail = saleDetail(id);
  if (!detail) notFound();
  return <TraceClient initial={JSON.parse(JSON.stringify(detail))} paypalLive={paypalConfigured()} />;
}
