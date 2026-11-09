import { describe, expect, it } from "vitest";
import { computeSplit, PLATFORM_FEE_RATE } from "@/lib/split";

const base = { amount: 14900, commissionRate: 0.08, minShare: 0.05, maxShare: 0.6 };

describe("computeSplit", () => {
  it("pays the whole pool, to the cent, across creators", () => {
    const r = computeSplit({
      ...base,
      candidates: [
        { creatorId: "a", sourceIds: ["s1"], influence: 80, reason: "" },
        { creatorId: "b", sourceIds: ["s2"], influence: 55, reason: "" },
        { creatorId: "c", sourceIds: ["s3"], influence: 30, reason: "" },
      ],
    });
    expect(r.commission).toBe(1192);
    expect(r.platformFee).toBe(Math.round(1192 * PLATFORM_FEE_RATE));
    expect(r.pool).toBe(r.commission - r.platformFee);
    expect(r.shares.reduce((a, s) => a + s.amount, 0)).toBe(r.pool);
  });

  it("drops trivial contributors below the minimum share", () => {
    const r = computeSplit({
      ...base,
      candidates: [
        { creatorId: "a", sourceIds: [], influence: 90, reason: "" },
        { creatorId: "b", sourceIds: [], influence: 80, reason: "" },
        { creatorId: "tiny", sourceIds: [], influence: 3, reason: "" },
      ],
    });
    const tiny = r.shares.find((s) => s.creatorId === "tiny")!;
    expect(tiny.amount).toBe(0);
    expect(tiny.excluded).toMatch(/minimum/);
  });

  it("caps any single creator at maxShare when others contributed", () => {
    const r = computeSplit({
      ...base,
      candidates: [
        { creatorId: "big", sourceIds: [], influence: 100, reason: "" },
        { creatorId: "small", sourceIds: [], influence: 20, reason: "" },
      ],
    });
    const big = r.shares.find((s) => s.creatorId === "big")!;
    expect(big.share).toBeCloseTo(0.6, 6);
    expect(r.shares.reduce((a, s) => a + s.amount, 0)).toBe(r.pool);
  });

  it("gives a sole source the full pool", () => {
    const r = computeSplit({ ...base, candidates: [{ creatorId: "solo", sourceIds: [], influence: 70, reason: "" }] });
    expect(r.shares[0].amount).toBe(r.pool);
  });

  it("charges the merchant nothing when every source is excluded", () => {
    const r = computeSplit({ ...base, candidates: [{ creatorId: "x", sourceIds: [], influence: 90, reason: "", excluded: "fraud" }] });
    expect(r.commission).toBe(0);
    expect(r.pool).toBe(0);
  });

  it("is exact for awkward amounts", () => {
    for (const amount of [1, 7, 99, 101, 12345, 99999]) {
      const r = computeSplit({
        ...base,
        amount,
        candidates: [1, 2, 3].map((n) => ({ creatorId: `c${n}`, sourceIds: [], influence: 33, reason: "" })),
      });
      expect(r.shares.reduce((a, s) => a + s.amount, 0)).toBe(r.pool);
    }
  });
});
