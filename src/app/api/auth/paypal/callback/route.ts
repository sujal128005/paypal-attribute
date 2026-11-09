import { NextResponse } from "next/server";
import { log } from "@/lib/engine";
import { appUrl } from "@/lib/http";
import { exchangeLoginCode } from "@/lib/paypal";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const creatorId = url.searchParams.get("state") ?? "";
  const base = appUrl(req);
  if (!code) return NextResponse.redirect(`${base}/creators?creator=${creatorId}&connected=cancelled`);
  try {
    const profile = await exchangeLoginCode(code);
    await mutate((state) => {
      const c = state.creators.find((x) => x.id === creatorId);
      if (!c) return;
      c.paypalConnected = true;
      if (profile.email) c.paypalEmail = profile.email;
      c.paypalPayerId = profile.payerId;
      log(state, { kind: "system", creatorId, message: `${c.name} connected PayPal account ${profile.email ?? ""} via Log in with PayPal` });
    });
    return NextResponse.redirect(`${base}/creators?creator=${creatorId}&connected=paypal`);
  } catch (err) {
    console.error("[login with paypal]", err);
    return NextResponse.redirect(`${base}/creators?creator=${creatorId}&connected=error`);
  }
}
