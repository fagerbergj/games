import { getBookAdvice } from "../lib/strategy";
import { DEFAULT_HOUSE_RULES } from "../lib/houseRules";
import type { Card, HouseRules } from "../lib/types";

function card(rank: number): Card {
  return { id: `s-${rank}-${Math.random()}`, suit: "spades" as const, rank, faceUp: true };
}

function up(rank: number): Card {
  return card(rank);
}

function rules(overrides: Partial<HouseRules> = {}): HouseRules {
  return { ...DEFAULT_HOUSE_RULES, ...overrides };
}

describe("getBookAdvice — required spot checks (default rules: any2 double, late surrender, S17)", () => {
  test("hard 16 vs dealer 7 (not a surrender cell) → hit", () => {
    const advice = getBookAdvice([card(10), card(6)], up(7), rules());
    expect(advice.book).toBe("hit");
    expect(advice.recommended).toBe("hit");
    expect(advice.ruleBlocked).toBe(false);
  });

  test("hard 12 vs dealer 4 → stand", () => {
    const advice = getBookAdvice([card(7), card(5)], up(4), rules());
    expect(advice.book).toBe("stand");
    expect(advice.recommended).toBe("stand");
  });

  test("soft 18 (A,7) vs dealer 9 → hit", () => {
    const advice = getBookAdvice([card(1), card(7)], up(9), rules());
    expect(advice.book).toBe("hit");
    expect(advice.recommended).toBe("hit");
  });

  test("soft 18 (A,7) vs dealer 3 → double, and this table allows it", () => {
    const advice = getBookAdvice([card(1), card(7)], up(3), rules());
    expect(advice.book).toBe("double");
    expect(advice.ruleBlocked).toBe(false);
    expect(advice.recommended).toBe("double");
  });

  test("8,8 vs anything → split, and this table allows it (spot-check a few dealer cards)", () => {
    for (const d of [2, 6, 7, 10, 1]) {
      const advice = getBookAdvice([card(8), card(8)], up(d), rules());
      expect(advice.book).toBe("split");
      expect(advice.ruleBlocked).toBe(false);
    }
  });

  test("10,10 → always stand, never split", () => {
    for (const d of [2, 6, 10, 1]) {
      const advice = getBookAdvice([card(10), card(13)], up(d), rules());
      expect(advice.book).toBe("stand");
      expect(advice.ruleBlocked).toBe(false);
    }
  });

  test("hard 11 vs dealer 10 → double, and this table allows it", () => {
    const advice = getBookAdvice([card(6), card(5)], up(10), rules());
    expect(advice.book).toBe("double");
    expect(advice.ruleBlocked).toBe(false);
    expect(advice.recommended).toBe("double");
  });
});

describe("getBookAdvice — surrender is rule-aware (item 11)", () => {
  test("hard 16 vs dealer 10 with late surrender on → surrender", () => {
    const advice = getBookAdvice([card(10), card(6)], up(10), rules({ surrender: "late" }));
    expect(advice.book).toBe("surrender");
    expect(advice.recommended).toBe("surrender");
    expect(advice.ruleBlocked).toBe(false);
  });

  test("hard 16 vs dealer 10 with surrender off → book still says surrender, but recommends hit", () => {
    const advice = getBookAdvice([card(10), card(6)], up(10), rules({ surrender: "none" }));
    expect(advice.book).toBe("surrender");
    expect(advice.recommended).toBe("hit");
    expect(advice.ruleBlocked).toBe(true);
  });

  test("hard 16 vs dealer 9 and dealer Ace also surrender under late surrender", () => {
    expect(getBookAdvice([card(10), card(6)], up(9), rules()).book).toBe("surrender");
    expect(getBookAdvice([card(10), card(6)], up(1), rules()).book).toBe("surrender");
  });

  test("hard 15 vs dealer 10 surrenders; vs dealer 9 does not", () => {
    expect(getBookAdvice([card(10), card(5)], up(10), rules()).book).toBe("surrender");
    expect(getBookAdvice([card(10), card(5)], up(9), rules()).book).toBe("hit");
  });

  test("a pair totaling 16 (8,8) is never offered surrender — it splits instead", () => {
    const advice = getBookAdvice([card(8), card(8)], up(10), rules());
    expect(advice.book).toBe("split");
  });

  test("a soft 16 (A,5) is never offered surrender", () => {
    const advice = getBookAdvice([card(1), card(5)], up(10), rules());
    expect(advice.book).not.toBe("surrender");
  });
});

describe("getBookAdvice — H17 vs S17 changes the chart, not just the game (item 11)", () => {
  test("hard 11 vs dealer Ace: double under H17, hit under S17", () => {
    const h17 = getBookAdvice([card(6), card(5)], up(1), rules({ dealerHitsSoft17: true }));
    const s17 = getBookAdvice([card(6), card(5)], up(1), rules({ dealerHitsSoft17: false }));
    expect(h17.book).toBe("double");
    expect(s17.book).toBe("hit");
  });

  test("soft 18 vs dealer 2: double under H17, stand under S17", () => {
    const h17 = getBookAdvice([card(1), card(7)], up(2), rules({ dealerHitsSoft17: true }));
    const s17 = getBookAdvice([card(1), card(7)], up(2), rules({ dealerHitsSoft17: false }));
    expect(h17.book).toBe("double");
    expect(s17.book).toBe("stand");
  });
});

describe("getBookAdvice — double restricted to 9-11 suppresses everything outside that set (item 11)", () => {
  test("soft 17 (A,6) vs dealer 3 books double, but a 9-11-only table can't offer it → hit", () => {
    const advice = getBookAdvice([card(1), card(6)], up(3), rules({ doubleRestriction: "9-11" }));
    expect(advice.book).toBe("double");
    expect(advice.ruleBlocked).toBe(true);
    expect(advice.recommended).toBe("hit");
  });

  test("hard 10 vs dealer 6 still doubles under a 9-11-only table (10 is in the set)", () => {
    const advice = getBookAdvice([card(6), card(4)], up(6), rules({ doubleRestriction: "9-11" }));
    expect(advice.book).toBe("double");
    expect(advice.ruleBlocked).toBe(false);
  });
});

describe("getBookAdvice — double after split (item 11)", () => {
  test("hard 11 vs dealer 6 on a split hand doubles when DAS is on", () => {
    const advice = getBookAdvice([card(6), card(5)], up(6), rules({ doubleAfterSplit: true }), true);
    expect(advice.book).toBe("double");
    expect(advice.ruleBlocked).toBe(false);
  });

  test("hard 11 vs dealer 6 on a split hand can't double when DAS is off → hit", () => {
    const advice = getBookAdvice([card(6), card(5)], up(6), rules({ doubleAfterSplit: false }), true);
    expect(advice.book).toBe("double");
    expect(advice.ruleBlocked).toBe(true);
    expect(advice.recommended).toBe("hit");
  });
});

describe("getBookAdvice — splits allowed (item 11)", () => {
  test("8,8 vs dealer 6 splits when splitting is allowed", () => {
    const advice = getBookAdvice([card(8), card(8)], up(6), rules({ maxSplits: 3 }));
    expect(advice.book).toBe("split");
    expect(advice.ruleBlocked).toBe(false);
  });

  test("8,8 vs dealer 6 falls back to playing the hard total when splitting is disabled", () => {
    const advice = getBookAdvice([card(8), card(8)], up(6), rules({ maxSplits: 0 }));
    expect(advice.book).toBe("split");
    expect(advice.ruleBlocked).toBe(true);
    expect(advice.recommended).toBe("stand"); // hard 16 vs 6 plays as stand
  });
});

describe("getBookAdvice — hard totals beyond the required spot checks", () => {
  test("hard 5-8 always hit", () => {
    for (const total of [5, 6, 7, 8]) {
      const advice = getBookAdvice([card(total - 2), card(2)], up(6), rules());
      expect(advice.book).toBe("hit");
    }
  });

  test("hard 17+ always stands", () => {
    const advice = getBookAdvice([card(10), card(7)], up(10), rules());
    expect(advice.book).toBe("stand");
  });

  test("hard 9 doubles only vs 3-6", () => {
    expect(getBookAdvice([card(4), card(5)], up(5), rules()).book).toBe("double");
    expect(getBookAdvice([card(4), card(5)], up(2), rules()).book).toBe("hit");
    expect(getBookAdvice([card(4), card(5)], up(7), rules()).book).toBe("hit");
  });
});

describe("getBookAdvice — pairs beyond the required spot checks", () => {
  test("A,A always splits", () => {
    for (const d of [2, 6, 10, 1]) {
      expect(getBookAdvice([card(1), card(1)], up(d), rules()).book).toBe("split");
    }
  });

  test("5,5 never splits — always double or hit, matching hard 10", () => {
    expect(getBookAdvice([card(5), card(5)], up(6), rules()).book).toBe("double");
    expect(getBookAdvice([card(5), card(5)], up(10), rules()).book).toBe("hit");
  });

  test("9,9 stands vs 7, 10, and Ace but splits elsewhere", () => {
    expect(getBookAdvice([card(9), card(9)], up(7), rules()).book).toBe("stand");
    expect(getBookAdvice([card(9), card(9)], up(10), rules()).book).toBe("stand");
    expect(getBookAdvice([card(9), card(9)], up(1), rules()).book).toBe("stand");
    expect(getBookAdvice([card(9), card(9)], up(6), rules()).book).toBe("split");
  });
});

describe("getBookAdvice — reasoning teaches the why, and varies by situation", () => {
  test("reason is non-empty prose, not just the action word", () => {
    const advice = getBookAdvice([card(9), card(6)], up(9), rules());
    expect(advice.reason.length).toBeGreaterThan(20);
    expect(advice.reason.toLowerCase()).not.toBe(advice.book);
  });

  test("reasoning text differs for different hands/dealer cards (not a constant string)", () => {
    const a = getBookAdvice([card(9), card(6)], up(9), rules()).reason; // 15 vs 9
    const b = getBookAdvice([card(7), card(5)], up(4), rules()).reason; // 12 vs 4
    const c = getBookAdvice([card(1), card(7)], up(9), rules()).reason; // soft 18 vs 9
    const texts = new Set([a, b, c]);
    expect(texts.size).toBe(3);
  });

  test("reasoning mentions the specific dealer card it's reasoning about", () => {
    const advice = getBookAdvice([card(7), card(5)], up(4), rules()); // 12 vs 4 → stand
    expect(advice.reason).toContain("4");
  });

  test("double reasoning names 'double', not just the fallback", () => {
    const advice = getBookAdvice([card(6), card(5)], up(6), rules()); // hard 11 vs 6
    expect(advice.book).toBe("double");
    expect(advice.reason.toLowerCase()).toContain("double");
  });

  test("surrender reasoning names 'surrender'", () => {
    const advice = getBookAdvice([card(10), card(6)], up(10), rules());
    expect(advice.reason.toLowerCase()).toContain("surrender");
  });

  // Item 13: standing on 12 can never bust — the old wording ("busts on a ten-card
  // either way") falsely implied hitting and standing were equally risky.
  test("hard 12 vs a strong dealer card explains the hit without claiming standing can bust", () => {
    const advice = getBookAdvice([card(7), card(5)], up(9), rules()); // 12 vs 9 → hit
    expect(advice.book).toBe("hit");
    expect(advice.reason.toLowerCase()).not.toContain("either way");
    expect(advice.reason.toLowerCase()).toContain("third");
  });
});
