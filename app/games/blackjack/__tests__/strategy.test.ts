import { getBookAdvice } from "../lib/strategy";
import type { Card } from "../lib/types";

function card(rank: number): Card {
  return { id: `s-${rank}-${Math.random()}`, suit: "spades" as const, rank, faceUp: true };
}

function up(rank: number): Card {
  return card(rank);
}

describe("getBookAdvice — required spot checks", () => {
  test("hard 16 vs dealer 10 → hit", () => {
    const advice = getBookAdvice([card(10), card(6)], up(10));
    expect(advice.book).toBe("hit");
    expect(advice.recommended).toBe("hit");
    expect(advice.noteUnavailable).toBe(false);
  });

  test("hard 12 vs dealer 4 → stand", () => {
    const advice = getBookAdvice([card(7), card(5)], up(4));
    expect(advice.book).toBe("stand");
    expect(advice.recommended).toBe("stand");
  });

  test("soft 18 (A,7) vs dealer 9 → hit", () => {
    const advice = getBookAdvice([card(1), card(7)], up(9));
    expect(advice.book).toBe("hit");
    expect(advice.recommended).toBe("hit");
  });

  test("soft 18 (A,7) vs dealer 3 → double, honestly falls back to stand (Ds) since this game has no double yet", () => {
    const advice = getBookAdvice([card(1), card(7)], up(3));
    expect(advice.book).toBe("double");
    expect(advice.noteUnavailable).toBe(true);
    expect(advice.recommended).toBe("stand");
  });

  test("8,8 vs anything → split (spot-check a few dealer cards)", () => {
    for (const d of [2, 6, 7, 10, 1]) {
      const advice = getBookAdvice([card(8), card(8)], up(d));
      expect(advice.book).toBe("split");
      expect(advice.noteUnavailable).toBe(true);
    }
  });

  test("10,10 → always stand, never split", () => {
    for (const d of [2, 6, 10, 1]) {
      const advice = getBookAdvice([card(10), card(13)], up(d));
      expect(advice.book).toBe("stand");
      expect(advice.noteUnavailable).toBe(false);
    }
  });

  test("hard 11 vs dealer 10 → double, honestly falls back to hit since this game has no double yet", () => {
    const advice = getBookAdvice([card(6), card(5)], up(10));
    expect(advice.book).toBe("double");
    expect(advice.noteUnavailable).toBe(true);
    expect(advice.recommended).toBe("hit");
  });
});

describe("getBookAdvice — honesty about unavailable actions", () => {
  test("book action of double never gets recommended directly — only hit or stand", () => {
    const advice = getBookAdvice([card(6), card(5)], up(6)); // hard 11 vs 6 → book double
    expect(advice.book).toBe("double");
    expect(["hit", "stand"]).toContain(advice.recommended);
    expect(advice.noteUnavailable).toBe(true);
  });

  test("book action of split never gets recommended directly", () => {
    const advice = getBookAdvice([card(7), card(7)], up(3)); // 7,7 vs 3 → book split
    expect(advice.book).toBe("split");
    expect(["hit", "stand"]).toContain(advice.recommended);
    expect(advice.noteUnavailable).toBe(true);
  });

  test("split fallback plays the pair as its hard total rather than a blind hit", () => {
    // 6,6 = hard 12 vs dealer 5 → hard-total chart says stand (12 vs 4-6).
    const advice = getBookAdvice([card(6), card(6)], up(5));
    expect(advice.book).toBe("split");
    expect(advice.recommended).toBe("stand");
  });
});

describe("getBookAdvice — hard totals beyond the required spot checks", () => {
  test("hard 5-8 always hit", () => {
    for (const total of [5, 6, 7, 8]) {
      const advice = getBookAdvice([card(total - 2), card(2)], up(6));
      expect(advice.book).toBe("hit");
    }
  });

  test("hard 17+ always stands", () => {
    const advice = getBookAdvice([card(10), card(7)], up(10));
    expect(advice.book).toBe("stand");
  });

  test("hard 9 doubles only vs 3-6", () => {
    expect(getBookAdvice([card(4), card(5)], up(5)).book).toBe("double");
    expect(getBookAdvice([card(4), card(5)], up(2)).book).toBe("hit");
    expect(getBookAdvice([card(4), card(5)], up(7)).book).toBe("hit");
  });
});

describe("getBookAdvice — pairs beyond the required spot checks", () => {
  test("A,A always splits", () => {
    for (const d of [2, 6, 10, 1]) {
      expect(getBookAdvice([card(1), card(1)], up(d)).book).toBe("split");
    }
  });

  test("5,5 never splits — always double or hit, matching hard 10", () => {
    expect(getBookAdvice([card(5), card(5)], up(6)).book).toBe("double");
    expect(getBookAdvice([card(5), card(5)], up(10)).book).toBe("hit");
  });

  test("9,9 stands vs 7, 10, and Ace but splits elsewhere", () => {
    expect(getBookAdvice([card(9), card(9)], up(7)).book).toBe("stand");
    expect(getBookAdvice([card(9), card(9)], up(10)).book).toBe("stand");
    expect(getBookAdvice([card(9), card(9)], up(1)).book).toBe("stand");
    expect(getBookAdvice([card(9), card(9)], up(6)).book).toBe("split");
  });
});

describe("getBookAdvice — reasoning teaches the why, and varies by situation", () => {
  test("reason is non-empty prose, not just the action word", () => {
    const advice = getBookAdvice([card(10), card(6)], up(10));
    expect(advice.reason.length).toBeGreaterThan(20);
    expect(advice.reason.toLowerCase()).not.toBe(advice.book);
  });

  test("reasoning text differs for different hands/dealer cards (not a constant string)", () => {
    const a = getBookAdvice([card(10), card(6)], up(10)).reason; // 16 vs 10
    const b = getBookAdvice([card(7), card(5)], up(4)).reason; // 12 vs 4
    const c = getBookAdvice([card(1), card(7)], up(9)).reason; // soft 18 vs 9
    const texts = new Set([a, b, c]);
    expect(texts.size).toBe(3);
  });

  test("reasoning mentions the specific dealer card it's reasoning about", () => {
    const advice = getBookAdvice([card(7), card(5)], up(4)); // 12 vs 4 → stand
    expect(advice.reason).toContain("4");
  });

  test("unavailable-double reasoning still explains the double, not just the fallback", () => {
    const advice = getBookAdvice([card(6), card(5)], up(6)); // hard 11 vs 6
    expect(advice.book).toBe("double");
    expect(advice.reason.toLowerCase()).toContain("double");
  });
});
