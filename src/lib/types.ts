// Domain model for PayPal Attribute.
// Money is always stored in integer cents to avoid floating point drift.

export type Cents = number;

export type Category =
  | "audio"
  | "running"
  | "coffee"
  | "camera"
  | "home"
  | "travel";

export interface Merchant {
  id: string;
  name: string;
  tagline: string;
  color: string;
  /** Commission paid on AI-attributed sales, e.g. 0.08 = 8 % */
  commissionRate: number;
  /** Monthly cap on attributed commission */
  monthlyBudget: Cents;
  /** Minimum share a source must earn to be paid (trivial mentions earn nothing) */
  minShare: number;
  /** Maximum share any single creator can take from one sale */
  maxShare: number;
  /** Return window before payouts are released */
  holdMinutes: number;
  paypalEmail: string;
  createdAt: string;
}

export interface Product {
  id: string;
  merchantId: string;
  title: string;
  brand: string;
  category: Category;
  price: Cents;
  currency: "USD";
  rating: number;
  features: string[];
  keywords: string[];
  imageUrl?: string;
  /** "catalog" for seeded products, "channel3" for live catalog results */
  origin: "catalog" | "channel3";
  externalUrl?: string;
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  niche: string;
  bio: string;
  color: string;
  paypalEmail: string;
  paypalConnected: boolean;
  paypalPayerId?: string;
  trustScore: number;
  joinedAt: string;
}

export type SourceKind = "review" | "video" | "guide" | "comparison" | "podcast";

export interface Source {
  id: string;
  creatorId: string;
  title: string;
  url: string;
  kind: SourceKind;
  categories: Category[];
  productIds: string[];
  keywords: string[];
  excerpt: string;
  publishedAt: string;
  status: "active" | "flagged" | "blocked";
  screening?: ScreeningResult;
}

export interface ScreeningResult {
  decision: "approved" | "review" | "blocked";
  flags: string[];
  summary: string;
  engine: "ai" | "rules";
  provider?: string;
  screenedAt: string;
}

export interface Citation {
  n: number;
  sourceId: string;
  creatorId: string;
  /** What the agent took from this source */
  claim: string;
  /** Product ids this citation supported */
  productIds: string[];
}

export interface Attribution {
  token: string;
  appId: string;
  query: string;
  answer: string;
  productIds: string[];
  citations: Citation[];
  createdAt: string;
  expiresAt: string;
  status: "open" | "converted" | "expired";
  engine: "ai" | "rules";
  provider?: string;
  channel: "shop-demo" | "api" | "mcp";
}

export type SaleStatus = "created" | "captured" | "refunded";

export interface Sale {
  id: string;
  attributionToken: string;
  merchantId: string;
  productId: string;
  productTitle: string;
  amount: Cents;
  currency: "USD";
  status: SaleStatus;
  mode: "paypal" | "simulated";
  paypalOrderId?: string;
  paypalCaptureId?: string;
  buyerEmail?: string;
  createdAt: string;
  capturedAt?: string;
  refundedAt?: string;
}

export interface Share {
  creatorId: string;
  sourceIds: string[];
  influence: number; // 0-100 as scored
  share: number; // final fraction of pool, 0-1
  amount: Cents;
  reason: string;
  excluded?: string; // reason if dropped
}

export interface RiskCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface Split {
  saleId: string;
  commissionRate: number;
  commission: Cents;
  platformFee: Cents;
  pool: Cents;
  shares: Share[];
  engine: "ai" | "rules";
  /** Which AI provider scored it (Groq, Gemini) when engine is "ai" */
  provider?: string;
  scoredAt: string;
  risk: { decision: "approved" | "review" | "blocked"; checks: RiskCheck[] };
  summary: string;
  /** Per-source influence as scored, before per-creator aggregation */
  scores: { sourceId: string; creatorId: string; influence: number; reason: string }[];
}

export type PayoutStatus = "held" | "released" | "sent" | "failed" | "reversed";

export interface Payout {
  id: string;
  saleId: string;
  creatorId: string;
  amount: Cents;
  status: PayoutStatus;
  releaseAt: string;
  createdAt: string;
  sentAt?: string;
  batchId?: string;
  itemId?: string;
  mode?: "paypal" | "simulated";
  note?: string;
}

export type LedgerType =
  | "commission_accrued"
  | "platform_fee"
  | "creator_earning"
  | "payout_sent"
  | "payout_reversed"
  | "clawback"
  | "clawback_recovered";

export interface LedgerEntry {
  id: string;
  ts: string;
  type: LedgerType;
  amount: Cents; // signed from the perspective of the party named
  saleId?: string;
  merchantId?: string;
  creatorId?: string;
  payoutId?: string;
  memo: string;
}

export interface ActivityEvent {
  id: string;
  ts: string;
  kind:
    | "attribution"
    | "sale"
    | "split"
    | "payout"
    | "refund"
    | "risk"
    | "source"
    | "settings"
    | "webhook"
    | "system";
  message: string;
  saleId?: string;
  creatorId?: string;
  merchantId?: string;
}

export interface RiskFlag {
  id: string;
  kind:
    | "self_dealing"
    | "citation_stuffing"
    | "prompt_injection"
    | "budget_cap"
    | "velocity"
    | "content_screening";
  severity: "low" | "medium" | "high";
  message: string;
  saleId?: string;
  sourceId?: string;
  creatorId?: string;
  status: "open" | "dismissed" | "confirmed";
  createdAt: string;
}

export interface DeveloperApp {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
  requests: number;
}

export interface Database {
  version: number;
  seededAt: string;
  merchants: Merchant[];
  products: Product[];
  creators: Creator[];
  sources: Source[];
  attributions: Attribution[];
  sales: Sale[];
  splits: Split[];
  payouts: Payout[];
  ledger: LedgerEntry[];
  activity: ActivityEvent[];
  risk: RiskFlag[];
  apps: DeveloperApp[];
  webhookEvents: { id: string; type: string; receivedAt: string }[];
  counters: Record<string, number>;
}
