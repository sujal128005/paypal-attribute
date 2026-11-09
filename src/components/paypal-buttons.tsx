"use client";

import { useEffect, useRef, useState } from "react";

type PayPalNamespace = {
  Buttons: (opts: {
    style?: Record<string, unknown>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError?: (err: unknown) => void;
    onCancel?: () => void;
  }) => { render: (el: HTMLElement) => Promise<void>; close?: () => void };
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

let loader: Promise<PayPalNamespace> | undefined;
function loadSdk(clientId: string) {
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    s.async = true;
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK missing")));
    s.onerror = () => reject(new Error("Could not load the PayPal SDK"));
    document.head.appendChild(s);
  });
  return loader;
}

/** Official PayPal Smart Payment Buttons, wired to our server-side order + capture routes. */
export function PayPalButtons({
  clientId,
  token,
  productId,
  onCaptured,
  onError,
}: {
  clientId: string;
  token: string;
  productId: string;
  onCaptured: (r: { saleId: string; split: unknown; payer?: string | null }) => void;
  onError: (msg: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const saleRef = useRef<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSdk(clientId)
      .then((paypal) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = "";
        return paypal
          .Buttons({
            style: { layout: "vertical", shape: "pill", color: "gold", label: "paypal", height: 48 },
            createOrder: async () => {
              const res = await fetch("/api/checkout/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, productId }) });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error?.message ?? "Could not create PayPal order");
              saleRef.current = json.saleId;
              return json.orderId as string;
            },
            onApprove: async ({ orderID }) => {
              const res = await fetch("/api/checkout/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleId: saleRef.current, orderId: orderID }) });
              const json = await res.json();
              if (!res.ok) return onError(json.error?.message ?? "Capture failed");
              onCaptured({ saleId: json.saleId, split: json.split, payer: json.payer });
            },
            onError: (err) => onError(err instanceof Error ? err.message : "PayPal checkout error"),
          })
          .render(ref.current)
          .then(() => !cancelled && setReady(true));
      })
      .catch((e: Error) => onError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, token, productId, onCaptured, onError]);

  return (
    <div>
      {!ready && <div className="h-[52px] animate-pulse rounded-full bg-mist" />}
      <div ref={ref} />
    </div>
  );
}
