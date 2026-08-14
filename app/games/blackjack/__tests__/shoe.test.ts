import { createShoe, needsReshuffle, DECK_COUNT_OPTIONS, PENETRATION_THRESHOLD } from "../lib/shoe";

describe("createShoe — composition", () => {
  test.each(DECK_COUNT_OPTIONS)("%i decks produces %i×52 cards", (n) => {
    expect(createShoe(n)).toHaveLength(n * 52);
  });

  test("exactly N copies of each rank+suit combination", () => {
    const n = 4;
    const shoe = createShoe(n);
    const counts = new Map<string, number>();
    for (const card of shoe) {
      const key = `${card.suit}-${card.rank}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // 4 suits x 13 ranks = 52 distinct rank+suit combinations.
    expect(counts.size).toBe(52);
    for (const count of counts.values()) {
      expect(count).toBe(n);
    }
  });

  test("card ids are unique within a shoe instance", () => {
    const shoe = createShoe(6);
    const ids = new Set(shoe.map((c) => c.id));
    expect(ids.size).toBe(shoe.length);
  });

  test("single-deck shoe still has 52 unique cards", () => {
    const shoe = createShoe(1);
    expect(shoe).toHaveLength(52);
    const counts = new Map<string, number>();
    for (const card of shoe) {
      const key = `${card.suit}-${card.rank}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(52);
    for (const count of counts.values()) expect(count).toBe(1);
  });

  test("shuffled — not returned in build order", () => {
    // Build order is hearts A-K, diamonds A-K, ... — statistically near-certain
    // to differ from a real shuffle across 312 cards.
    const shoe = createShoe(6);
    const first13Ranks = shoe.slice(0, 13).map((c) => c.rank);
    const buildOrderRanks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    expect(first13Ranks).not.toEqual(buildOrderRanks);
  });
});

describe("needsReshuffle", () => {
  test("full shoe never needs a reshuffle", () => {
    expect(needsReshuffle(6 * 52, 6)).toBe(false);
  });

  test("just above the penetration threshold — no reshuffle", () => {
    const total = 6 * 52;
    const justAbove = Math.ceil(total * PENETRATION_THRESHOLD) + 1;
    expect(needsReshuffle(justAbove, 6)).toBe(false);
  });

  test("just below the penetration threshold — reshuffle triggers", () => {
    const total = 6 * 52;
    const justBelow = Math.floor(total * PENETRATION_THRESHOLD) - 1;
    expect(needsReshuffle(justBelow, 6)).toBe(true);
  });

  test("empty shoe always needs a reshuffle", () => {
    expect(needsReshuffle(0, 6)).toBe(true);
  });

  test("scales with deck count — 25% of a 1-deck shoe", () => {
    expect(needsReshuffle(14, 1)).toBe(false); // 14/52 ≈ 26.9%
    expect(needsReshuffle(12, 1)).toBe(true); // 12/52 ≈ 23.1%
  });
});
