import { hiLoValue, runningCount, decksRemaining, trueCount, countMeaning, rankLabel } from "../lib/count";
import type { Card } from "../lib/types";

function card(rank: number): Card {
  return { id: `c-${rank}-${Math.random()}`, suit: "spades" as const, rank, faceUp: true };
}

describe("hiLoValue", () => {
  test("2-6 are +1", () => {
    for (let r = 2; r <= 6; r++) expect(hiLoValue(r)).toBe(1);
  });
  test("7-9 are 0", () => {
    for (let r = 7; r <= 9; r++) expect(hiLoValue(r)).toBe(0);
  });
  test("10/J/Q/K are -1", () => {
    for (let r = 10; r <= 13; r++) expect(hiLoValue(r)).toBe(-1);
  });
  test("Ace is -1", () => {
    expect(hiLoValue(1)).toBe(-1);
  });
});

describe("rankLabel", () => {
  test("face cards and ace get letters", () => {
    expect(rankLabel(1)).toBe("A");
    expect(rankLabel(11)).toBe("J");
    expect(rankLabel(12)).toBe("Q");
    expect(rankLabel(13)).toBe("K");
  });
  test("number cards are their own label", () => {
    expect(rankLabel(7)).toBe("7");
  });
});

describe("runningCount — known sequence", () => {
  test("a mixed sequence sums Hi-Lo tags in order", () => {
    // 2,3,4,5,6 = +5; 7,8,9 = 0; 10,J,Q,K,A = -5 → net 0
    const seq = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1].map(card);
    expect(runningCount(seq)).toBe(0);
  });

  test("all low cards push the count positive", () => {
    const seq = [2, 3, 4, 5, 6].map(card);
    expect(runningCount(seq)).toBe(5);
  });

  test("all tens/aces push the count negative", () => {
    const seq = [10, 11, 12, 13, 1].map(card);
    expect(runningCount(seq)).toBe(-5);
  });

  test("empty sequence is 0", () => {
    expect(runningCount([])).toBe(0);
  });

  test("accumulates incrementally the same as computing it all at once", () => {
    const first = [2, 2, 2].map(card);
    const second = [10, 10].map(card);
    expect(runningCount(first) + runningCount(second)).toBe(runningCount([...first, ...second]));
  });
});

describe("decksRemaining", () => {
  test("full 6-deck shoe", () => {
    expect(decksRemaining(6 * 52)).toBe(6);
  });
  test("half a deck left", () => {
    expect(decksRemaining(26)).toBe(0.5);
  });
  test("floors at 0.5 decks even when the shoe is nearly empty", () => {
    expect(decksRemaining(5)).toBe(0.5);
    expect(decksRemaining(0)).toBe(0.5);
  });
});

describe("trueCount", () => {
  test("running +6 over 3.0 decks remaining ≈ +2.0", () => {
    expect(trueCount(6, 3)).toBe(2);
  });
  test("rounds to the nearest half", () => {
    // 5 / 3 = 1.666... → rounds to 1.5
    expect(trueCount(5, 3)).toBe(1.5);
  });
  test("rounds a value nearer the next half up", () => {
    // 7 / 4 = 1.75 → rounds to 2.0
    expect(trueCount(7, 4)).toBe(2);
  });
  test("negative running count produces a negative true count", () => {
    expect(trueCount(-8, 4)).toBe(-2);
  });
  test("zero running count is neutral regardless of decks remaining", () => {
    expect(trueCount(0, 2)).toBe(0);
  });
  test("clamps the divisor at 0.5 decks near shoe exhaustion", () => {
    expect(trueCount(1, 0.1)).toBe(2); // 1 / 0.5, not 1 / 0.1
  });
});

describe("countMeaning", () => {
  test("neutral around zero", () => {
    expect(countMeaning(0)).toMatch(/neutral/i);
    expect(countMeaning(1)).toMatch(/neutral/i);
    expect(countMeaning(-0.5)).toMatch(/neutral/i);
  });
  test("favorable at +2 or better", () => {
    expect(countMeaning(2)).toMatch(/rich in tens/i);
    expect(countMeaning(3.5)).toMatch(/rich in tens/i);
  });
  test("unfavorable at -1 or worse", () => {
    expect(countMeaning(-1)).toMatch(/small-card heavy/i);
    expect(countMeaning(-4)).toMatch(/small-card heavy/i);
  });
  test("meaning text differs across bands (not a constant string)", () => {
    const texts = new Set([countMeaning(-3), countMeaning(0), countMeaning(3)]);
    expect(texts.size).toBe(3);
  });
});
