import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { EngineError } from "./engine";
import { PayPalError } from "./paypal";
import { db, mutate } from "./store";
import type { DeveloperApp } from "./types";

export const ok = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === "number" ? { status: init } : init);

export function fail(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: { type: "invalid_request", message: "Invalid request body", issues: err.issues } }, { status: 400 });
  }
  if (err instanceof EngineError) return NextResponse.json({ error: { type: "invalid_request", message: err.message } }, { status: err.status });
  if (err instanceof PayPalError) {
    return NextResponse.json({ error: { type: "paypal_error", message: err.message, debug_id: err.debugId, details: err.details } }, { status: err.status >= 500 ? 502 : 400 });
  }
  if (err instanceof ApiAuthError) return NextResponse.json({ error: { type: "authentication_error", message: err.message } }, { status: 401 });
  console.error(err);
  return NextResponse.json({ error: { type: "server_error", message: "Something went wrong" } }, { status: 500 });
}

export class ApiAuthError extends Error {}

/** Public API auth: `Authorization: Bearer pa_test_…` */
export async function authenticate(req: Request): Promise<DeveloperApp> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.replace(/^Bearer\s+/i, "").trim();
  if (!key) throw new ApiAuthError("Missing API key. Send `Authorization: Bearer pa_test_…`.");
  const app = db().apps.find((a) => a.apiKey === key);
  if (!app) throw new ApiAuthError("Invalid API key.");
  await mutate((state) => {
    const a = state.apps.find((x) => x.id === app.id);
    if (a) a.requests += 1;
  });
  return app;
}

export function appUrl(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  return `${proto}://${host}`;
}
