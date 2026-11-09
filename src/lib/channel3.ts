// Channel3 universal product catalog (optional). When CHANNEL3_API_KEY is set the shopping
// agent searches live products across thousands of brands; otherwise the seeded catalog is used.
import type { Category, Product } from "./types";
import { tokenize } from "./util";

export const channel3Configured = () => Boolean(process.env.CHANNEL3_API_KEY);
export const MARKETPLACE_MERCHANT_ID = "m_marketplace";

const CATEGORY_HINTS: Record<Category, string[]> = {
  audio: ["headphone", "headphones", "earbuds", "earbud", "speaker", "audio", "anc"],
  running: ["running", "shoe", "shoes", "sneaker", "trainer", "trail"],
  coffee: ["coffee", "espresso", "grinder", "pour", "kettle", "brew"],
  camera: ["camera", "lens", "mirrorless", "vlog", "tripod"],
  home: ["purifier", "vacuum", "lamp", "home", "smart", "air"],
  travel: ["luggage", "carry", "backpack", "bag", "travel", "packing", "daypack"],
};

export function inferCategory(text: string): Category {
  const terms = new Set(tokenize(text));
  let best: Category = "home";
  let bestScore = 0;
  for (const [cat, hints] of Object.entries(CATEGORY_HINTS) as [Category, string[]][]) {
    const score = hints.filter((h) => terms.has(h)).length;
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}

type C3Product = {
  id: string;
  title: string;
  url?: string;
  brand_name?: string | null;
  description?: string | null;
  image_urls?: string[] | null;
  images?: { url: string }[] | null;
  key_features?: string[] | null;
  price?: { price: number; currency?: string } | null;
  offers?: { url?: string; domain?: string; price?: { price: number; currency?: string }; max_commission_rate?: number }[] | null;
};

export async function searchChannel3(query: string, maxPrice?: number, limit = 6): Promise<Product[]> {
  const res = await fetch("https://api.trychannel3.com/v1/search", {
    method: "POST",
    headers: { "x-api-key": process.env.CHANNEL3_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, ...(maxPrice ? { filters: { price: { max_price: maxPrice } } } : {}) }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Channel3 search failed (${res.status})`);
  const json = (await res.json()) as { products?: C3Product[] };
  return (json.products ?? [])
    .map((p): Product | null => {
      const offer = p.offers?.[0];
      const price = offer?.price?.price ?? p.price?.price;
      if (!price) return null;
      const category = inferCategory(`${p.title} ${p.description ?? ""}`);
      return {
        id: `c3_${p.id}`.slice(0, 64),
        merchantId: MARKETPLACE_MERCHANT_ID,
        title: p.title.slice(0, 120),
        brand: p.brand_name ?? offer?.domain ?? "Marketplace",
        category,
        price: Math.round(price * 100),
        currency: "USD",
        rating: 4.5,
        features: (p.key_features ?? []).slice(0, 4),
        keywords: tokenize(`${p.title} ${p.brand_name ?? ""}`).slice(0, 12),
        imageUrl: p.image_urls?.[0] ?? p.images?.[0]?.url,
        origin: "channel3",
        externalUrl: offer?.url ?? p.url,
      };
    })
    .filter((p): p is Product => p !== null);
}
