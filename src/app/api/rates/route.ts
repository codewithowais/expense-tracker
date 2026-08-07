import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live precious-metal spot rates, converted to the user's currency per gram.
 *
 * Uses two free, no-key public APIs (server-side so no CORS / no secrets):
 *   - gold-api.com  → metal spot in USD per troy ounce (XAU / XAG)
 *   - open.er-api.com → USD → currency exchange rates
 *
 * Returns a PURE (24k, .999) per-gram price; the client applies unit and
 * purity adjustments, and the figure is always user-editable — international
 * spot + FX runs a few percent off local bazaar/Sarafa rates.
 */

const SYMBOL = { gold: "XAU", silver: "XAG" } as const;
const GRAMS_PER_TROY_OZ = 31.1034768;
// Metal spot and FX barely move minute-to-minute; cache to spare the free tiers.
const CACHE_SECONDS = 600;

export async function GET(req: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const metal = req.nextUrl.searchParams.get("metal");
  const currency = (req.nextUrl.searchParams.get("currency") ?? "USD").toUpperCase();
  if (metal !== "gold" && metal !== "silver") {
    return NextResponse.json({ error: "unsupported-metal" }, { status: 400 });
  }

  try {
    const [spotRes, fxRes] = await Promise.all([
      fetch(`https://api.gold-api.com/price/${SYMBOL[metal]}`, {
        next: { revalidate: CACHE_SECONDS },
      }),
      fetch("https://open.er-api.com/v6/latest/USD", {
        next: { revalidate: CACHE_SECONDS },
      }),
    ]);
    if (!spotRes.ok || !fxRes.ok) {
      return NextResponse.json({ error: "upstream-unavailable" }, { status: 502 });
    }

    const spot = (await spotRes.json()) as { price?: number; updatedAt?: string };
    const fx = (await fxRes.json()) as { rates?: Record<string, number> };

    const usdPerOunce = spot.price;
    const fxRate = currency === "USD" ? 1 : fx.rates?.[currency];
    if (typeof usdPerOunce !== "number" || typeof fxRate !== "number") {
      return NextResponse.json({ error: "unsupported-currency" }, { status: 400 });
    }

    const pricePerOunce = usdPerOunce * fxRate;
    const pricePerGram = pricePerOunce / GRAMS_PER_TROY_OZ;

    return NextResponse.json({
      metal,
      currency,
      pricePerGram,
      pricePerOunce,
      usdPerOunce,
      fxRate,
      asOf: spot.updatedAt ?? null,
    });
  } catch {
    return NextResponse.json({ error: "fetch-failed" }, { status: 502 });
  }
}
