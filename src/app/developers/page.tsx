import type { Metadata } from "next";
import { headers } from "next/headers";
import { openApiSpec } from "@/lib/openapi";
import { db } from "@/lib/store";
import { DevClient, type DevData } from "./dev-client";

export const metadata: Metadata = { title: "Developers" };
export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const h = await headers();
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const s = db();
  const spec = openApiSpec(base);
  const endpoints = Object.entries(spec.paths).flatMap(([path, ops]) =>
    Object.entries(ops as Record<string, { summary: string; description?: string; operationId: string }>).map(([method, op]) => ({ method: method.toUpperCase(), path, summary: op.summary, description: op.description ?? "", operationId: op.operationId })),
  );
  const data: DevData = {
    base,
    apps: s.apps.map((a) => ({ id: a.id, name: a.name, apiKey: a.apiKey, requests: a.requests, createdAt: a.createdAt })),
    products: s.products.filter((p) => p.origin === "catalog").map((p) => ({ id: p.id, title: p.title })),
    sources: s.sources.filter((x) => x.status === "active").map((x) => ({ id: x.id, title: x.title, productIds: x.productIds, creator: s.creators.find((c) => c.id === x.creatorId)?.name ?? "" })),
    endpoints,
  };
  return <DevClient data={JSON.parse(JSON.stringify(data))} />;
}
