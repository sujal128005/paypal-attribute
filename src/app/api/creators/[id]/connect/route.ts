// Creator onboarding. With PayPal keys: real "Log in with PayPal" (OpenID Connect).
// Without (or until PAYPAL_LOGIN_ENABLED=true): a clearly-labelled simulated connection.
import { NextResponse } from "next/server";
import { log } from "@/lib/engine";
import { appUrl, fail } from "@/lib/http";
import { loginWithPayPalEnabled, loginWithPayPalUrl } from "@/lib/paypal";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const base = appUrl(req);
    if (loginWithPayPalEnabled() && new URL(req.url).searchParams.get("mode") !== "simulated") {
      return NextResponse.redirect(loginWithPayPalUrl(id, `${base}/api/auth/paypal/callback`));
    }
    await mutate((state) => {
      const c = state.creators.find((x) => x.id === id);
      if (!c) return;
      c.paypalConnected = true;
      log(state, { kind: "system", creatorId: id, message: `${c.name} connected PayPal (simulated) — held payouts are now eligible` });
    });
    return NextResponse.redirect(`${base}/creators?creator=${id}&connected=simulated`);
  } catch (err) {
    return fail(err);
  }
}
