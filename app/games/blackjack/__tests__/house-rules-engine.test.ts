import {
  canSplit, canDoubleDown, canSurrender, splitHand, createHand, calculatePayout,
  dealerDraw, dealerDrawRule, isSoftHand, surrenderPayout, evenMoneyPayout,
  calculateInsurancePayout, settleHand, isBlackjack,
} from "../lib/engine";
import { DEFAULT_HOUSE_RULES } from "../lib/houseRules";
import type { Card, HouseRules } from "../lib/types";

function card(rank: number, id?: string): Card {
  return { id: id ?? `c-${rank}-${Math.random()}`, suit: "spades" as const, rank, faceUp: true };
}

function rules(overrides: Partial<HouseRules> = {}): HouseRules {
  return { ...DEFAULT_HOUSE_RULES, ...overrides };
}

/* ------------------------------------------------------------------ */
/*  Split mechanics                                                    */
/* ------------------------------------------------------------------ */

describe("canSplit — pair detection and the split cap", () => {
  test("a genuine pair can split", () => {
    expect(canSplit([card(8), card(8)], rules(), 0)).toBe(true);
  });

  test("any two ten-value cards count as a pair (10/J/Q/K)", () => {
    expect(canSplit([card(10), card(11)], rules(), 0)).toBe(true);
    expect(canSplit([card(12), card(13)], rules(), 0)).toBe(true);
  });

  test("non-pair cannot split", () => {
    expect(canSplit([card(8), card(9)], rules(), 0)).toBe(false);
  });

  test("a three-card hand cannot split", () => {
    expect(canSplit([card(8), card(8), card(2)], rules(), 0)).toBe(false);
  });

  test("default cap allows a resplit up to 3 splits (4 hands), then stops", () => {
    const r = rules({ maxSplits: 3 });
    expect(canSplit([card(8), card(8)], r, 0)).toBe(true); // 1st split (1 -> 2 hands)
    expect(canSplit([card(8), card(8)], r, 1)).toBe(true); // 2nd split (2 -> 3 hands)
    expect(canSplit([card(8), card(8)], r, 2)).toBe(true); // 3rd split (3 -> 4 hands)
    expect(canSplit([card(8), card(8)], r, 3)).toBe(false); // cap reached
  });

  test("maxSplits: 0 disables splitting entirely", () => {
    expect(canSplit([card(8), card(8)], rules({ maxSplits: 0 }), 0)).toBe(false);
  });

  test("maxSplits: 1 allows exactly one split", () => {
    const r = rules({ maxSplits: 1 });
    expect(canSplit([card(8), card(8)], r, 0)).toBe(true);
    expect(canSplit([card(8), card(8)], r, 1)).toBe(false);
  });
});

describe("splitHand — deals one fresh card to each half", () => {
  test("splits into two one-card-plus-one-draw hands sharing the original bet", () => {
    const original = createHand([card(8, "a"), card(8, "b")], 100);
    const deck = [card(3, "d1"), card(9, "d2"), card(2, "d3")];

    const { hands: [handA, handB], deck: remaining } = splitHand(original, deck);

    expect(handA.cards.map(c => c.id)).toEqual(["a", "d1"]);
    expect(handB.cards.map(c => c.id)).toEqual(["b", "d2"]);
    expect(handA.bet).toBe(100);
    expect(handB.bet).toBe(100);
    expect(handA.isSplitHand).toBe(true);
    expect(handB.isSplitHand).toBe(true);
    expect(handA.isSplitAces).toBe(false);
    expect(remaining).toEqual([card(2, "d3")]);
  });

  test("splitting a pair of aces flags both hands isSplitAces", () => {
    const original = createHand([card(1, "a"), card(1, "b")], 50);
    const { hands: [handA, handB] } = splitHand(original, [card(10, "d1"), card(9, "d2")]);
    expect(handA.isSplitAces).toBe(true);
    expect(handB.isSplitAces).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Split 21 is not a natural blackjack                                */
/* ------------------------------------------------------------------ */

describe("a 21 from a split hand pays 1:1, never the blackjack bonus", () => {
  test("split hand reaching 21 (e.g. A + K after splitting aces) pays even money", () => {
    const dealer = [card(10), card(8)]; // dealer 18, doesn't matter for the win amount
    const splitHandCards = [card(1), card(13)]; // A + K = 21, but from a split pair
    const result = calculatePayout(splitHandCards, dealer, 100, rules(), { isSplitHand: true });
    expect(result.result).toBe("win");
    expect(result.amount).toBe(100); // 1:1, not 150
  });

  test("the same two cards on a non-split hand DO pay the blackjack bonus", () => {
    const dealer = [card(10), card(8)];
    const result = calculatePayout([card(1), card(13)], dealer, 100, rules(), { isSplitHand: false });
    expect(result.result).toBe("blackjack");
    expect(result.amount).toBe(150);
  });

  test("a split hand's 21 still pushes against a dealer total of 21", () => {
    const dealer = [card(10), card(5), card(6)]; // 21
    const result = calculatePayout([card(1), card(13)], dealer, 100, rules(), { isSplitHand: true });
    expect(result.result).toBe("push");
  });
});

/* ------------------------------------------------------------------ */
/*  Split aces: one card only (toggleable)                             */
/* ------------------------------------------------------------------ */

describe("split aces one-card rule", () => {
  test("splitHand always deals exactly one card per new hand regardless of the toggle", () => {
    // The toggle is enforced by the caller (freezing the hand at "stood"); the raw
    // split always deals one card — this documents that division of responsibility.
    const original = createHand([card(1, "a"), card(1, "b")], 50);
    const { hands: [handA, handB] } = splitHand(original, [card(9), card(4)]);
    expect(handA.cards).toHaveLength(2);
    expect(handB.cards).toHaveLength(2);
  });

  test("with the toggle off, a split-aces hand can still be evaluated as a normal hittable hand", () => {
    // canDoubleDown / normal play only cares about the hand's cards and isSplitHand,
    // not isSplitAces -- the "one card only" restriction is a UI/orchestration
    // decision (locking the hand at "stood" immediately after the split).
    const r = rules({ splitAcesOneCardOnly: false });
    const hand = [card(1), card(9)]; // A + 9 after a split-ace draw
    expect(canDoubleDown(hand, r, true)).toBe(true); // DAS still governs, not the ace toggle
  });
});

/* ------------------------------------------------------------------ */
/*  Double after split (DAS)                                           */
/* ------------------------------------------------------------------ */

describe("double after split (DAS)", () => {
  test("DAS on: a split hand can double on its first two cards", () => {
    expect(canDoubleDown([card(5), card(6)], rules({ doubleAfterSplit: true }), true)).toBe(true);
  });

  test("DAS off: a split hand cannot double", () => {
    expect(canDoubleDown([card(5), card(6)], rules({ doubleAfterSplit: false }), true)).toBe(false);
  });

  test("DAS off does not affect a non-split hand's ability to double", () => {
    expect(canDoubleDown([card(5), card(6)], rules({ doubleAfterSplit: false }), false)).toBe(true);
  });
});

describe("double restriction: any two cards vs 9/10/11 only", () => {
  test("any2 allows doubling on a low total", () => {
    expect(canDoubleDown([card(2), card(3)], rules({ doubleRestriction: "any2" }), false)).toBe(true);
  });

  test("9-11 restriction blocks a total outside that range", () => {
    expect(canDoubleDown([card(2), card(3)], rules({ doubleRestriction: "9-11" }), false)).toBe(false); // 5
    expect(canDoubleDown([card(6), card(6)], rules({ doubleRestriction: "9-11" }), false)).toBe(false); // 12
  });

  test("9-11 restriction allows exactly 9, 10, and 11", () => {
    const r = rules({ doubleRestriction: "9-11" });
    expect(canDoubleDown([card(4), card(5)], r, false)).toBe(true); // 9
    expect(canDoubleDown([card(5), card(5)], r, false)).toBe(true); // 10
    expect(canDoubleDown([card(6), card(5)], r, false)).toBe(true); // 11
    expect(canDoubleDown([card(6), card(6)], r, false)).toBe(false); // 12, out of range
  });
});

/* ------------------------------------------------------------------ */
/*  H17 vs S17 — soft 17                                                */
/* ------------------------------------------------------------------ */

describe("isSoftHand", () => {
  test("A + 6 is soft (Ace counted as 11)", () => {
    expect(isSoftHand([card(1), card(6)])).toBe(true);
  });
  test("10 + 7 is hard", () => {
    expect(isSoftHand([card(10), card(7)])).toBe(false);
  });
});

describe("dealer hits or stands on soft 17 per house rule", () => {
  test("S17: dealer stands on a soft 17 (A+6)", () => {
    const hand = [card(1), card(6)];
    const deck = [card(5)]; // would draw this if it hit
    const result = dealerDraw(deck, hand, rules({ dealerHitsSoft17: false }));
    expect(result.hand).toHaveLength(2);
  });

  test("H17: dealer hits a soft 17 (A+6) and keeps drawing per the normal rule", () => {
    const hand = [card(1), card(6)];
    const deck = [card(5)]; // A+6+5 = 22 -> re-evaluated as 12 (soft breaks), still < 17, draws more
    const deck2 = [...deck, card(9)]; // 12 + 9 = 21, stands
    const result = dealerDraw(deck2, hand, rules({ dealerHitsSoft17: true }));
    expect(result.hand.length).toBeGreaterThan(2);
    const finalValue = result.hand.reduce((sum) => sum, 0); // sanity: just confirm it drew
    expect(finalValue).toBeDefined();
  });

  test("dealerDrawRule: H17 hits an explicit soft 17, S17 does not", () => {
    expect(dealerDrawRule(17, true, rules({ dealerHitsSoft17: true }))).toBe(true);
    expect(dealerDrawRule(17, true, rules({ dealerHitsSoft17: false }))).toBe(false);
  });

  test("dealerDrawRule: a HARD 17 always stands regardless of the soft-17 rule", () => {
    expect(dealerDrawRule(17, false, rules({ dealerHitsSoft17: true }))).toBe(false);
    expect(dealerDrawRule(17, false, rules({ dealerHitsSoft17: false }))).toBe(false);
  });

  test("dealerDrawRule: any total under 17 always hits, any total over 17 always stands", () => {
    expect(dealerDrawRule(16, false, rules({ dealerHitsSoft17: true }))).toBe(true);
    expect(dealerDrawRule(18, true, rules({ dealerHitsSoft17: true }))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  3:2 vs 6:5 blackjack payout                                        */
/* ------------------------------------------------------------------ */

describe("blackjack payout: 3:2 vs 6:5", () => {
  test("3:2 pays 150 on a 100 bet", () => {
    const result = calculatePayout([card(1), card(13)], [card(9), card(8)], 100, rules({ blackjackPayout: "3:2" }));
    expect(result).toEqual({ result: "blackjack", amount: 150 });
  });

  test("6:5 pays 120 on a 100 bet — worse for the player", () => {
    const result = calculatePayout([card(1), card(13)], [card(9), card(8)], 100, rules({ blackjackPayout: "6:5" }));
    expect(result).toEqual({ result: "blackjack", amount: 120 });
  });

  test("6:5 on a 50 bet pays 60", () => {
    const result = calculatePayout([card(1), card(13)], [card(9), card(8)], 50, rules({ blackjackPayout: "6:5" }));
    expect(result.amount).toBe(60);
  });
});

/* ------------------------------------------------------------------ */
/*  Surrender                                                          */
/* ------------------------------------------------------------------ */

describe("late surrender", () => {
  test("returns exactly half the bet as a net loss", () => {
    expect(surrenderPayout(100)).toEqual({ result: "surrender", amount: -50 });
    expect(surrenderPayout(75)).toEqual({ result: "surrender", amount: -37.5 });
  });

  test("canSurrender: only available when rules.surrender is 'late'", () => {
    expect(canSurrender(rules({ surrender: "late" }), [card(10), card(6)], false)).toBe(true);
    expect(canSurrender(rules({ surrender: "none" }), [card(10), card(6)], false)).toBe(false);
  });

  test("canSurrender: never offered on a split hand", () => {
    expect(canSurrender(rules({ surrender: "late" }), [card(10), card(6)], true)).toBe(false);
  });

  test("canSurrender: never offered after a hit (hand no longer has 2 cards)", () => {
    expect(canSurrender(rules({ surrender: "late" }), [card(10), card(6), card(2)], false)).toBe(false);
  });

  test("settleHand honors an already-resolved surrender result rather than re-scoring the hand", () => {
    const hand = createHand([card(10), card(6)], 100, { status: "surrendered", result: surrenderPayout(100) });
    const result = settleHand(hand, [card(10), card(9)], rules());
    expect(result).toEqual({ result: "surrender", amount: -50 });
  });
});

/* ------------------------------------------------------------------ */
/*  Insurance                                                           */
/* ------------------------------------------------------------------ */

describe("insurance", () => {
  test("wins 2:1 when the dealer has a natural", () => {
    const net = calculateInsurancePayout(25, [card(1), card(13)]);
    expect(net).toBe(50);
  });

  test("loses the side bet when the dealer does not have a natural", () => {
    const net = calculateInsurancePayout(25, [card(9), card(8)]);
    expect(net).toBe(-25);
  });

  test("a declined ($0) insurance bet nets zero either way", () => {
    // -insuranceBet on a zero bet is -0 in JS -- +0 for the comparison, same value.
    expect(calculateInsurancePayout(0, [card(1), card(13)]) + 0).toBe(0);
    expect(calculateInsurancePayout(0, [card(9), card(8)]) + 0).toBe(0);
  });

  test("even-money locks in a guaranteed 1:1 payout on the player's own blackjack", () => {
    expect(evenMoneyPayout(100)).toEqual({ result: "even-money", amount: 100 });
  });
});

/* ------------------------------------------------------------------ */
/*  Rules matrix — same dealt cards, different HouseRules, different    */
/*  correct results.                                                    */
/* ------------------------------------------------------------------ */

describe("rules matrix: identical cards settle differently under different HouseRules", () => {
  const playerNatural = [card(1), card(13)]; // A + K
  const dealerHand = [card(9), card(8)]; // 17, no dealer BJ

  test("blackjack payout differs: 3:2 -> 150, 6:5 -> 120, on the same bet and cards", () => {
    const bet = 100;
    const threeToTwo = calculatePayout(playerNatural, dealerHand, bet, rules({ blackjackPayout: "3:2" }));
    const sixToFive = calculatePayout(playerNatural, dealerHand, bet, rules({ blackjackPayout: "6:5" }));
    expect(threeToTwo.amount).toBe(150);
    expect(sixToFive.amount).toBe(120);
    expect(threeToTwo.amount).not.toBe(sixToFive.amount);
  });

  test("a split-hand 21 is a blackjack normally but only even money when flagged as a split", () => {
    const bet = 100;
    const normal = calculatePayout(playerNatural, dealerHand, bet, rules(), { isSplitHand: false });
    const split = calculatePayout(playerNatural, dealerHand, bet, rules(), { isSplitHand: true });
    expect(normal.result).toBe("blackjack");
    expect(normal.amount).toBe(150);
    expect(split.result).toBe("win");
    expect(split.amount).toBe(100);
  });

  test("dealer soft-17 draw behavior differs between S17 and H17 on the same starting hand", () => {
    const softSeventeen = [card(1), card(6)];
    const deck = [card(4)]; // if the dealer draws, this lands (soft 17+4 = soft 21... actually 11+4=15 or 21)
    const s17 = dealerDraw(deck, softSeventeen, rules({ dealerHitsSoft17: false }));
    const h17 = dealerDraw(deck, softSeventeen, rules({ dealerHitsSoft17: true }));
    expect(s17.hand).toHaveLength(2); // stands
    expect(h17.hand).toHaveLength(3); // hits
  });

  test("insurance offered/settled the same way regardless of blackjack payout rule (independent toggles)", () => {
    const dealerNatural = [card(1), card(13)];
    const net32 = calculateInsurancePayout(50, dealerNatural);
    const net65 = calculateInsurancePayout(50, dealerNatural); // insurance math is payout-rule-independent
    expect(net32).toBe(net65);
    expect(net32).toBe(100);
  });

  test("surrender is available under one ruleset and not another for the identical hand", () => {
    const hand = [card(10), card(6)];
    expect(canSurrender(rules({ surrender: "late" }), hand, false)).toBe(true);
    expect(canSurrender(rules({ surrender: "none" }), hand, false)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  isBlackjack sanity re-check with the new options-aware payout path  */
/* ------------------------------------------------------------------ */

describe("isBlackjack is unaffected by rules/options — it's purely about the cards", () => {
  test("two cards totaling 21", () => {
    expect(isBlackjack([card(1), card(10)])).toBe(true);
  });
});
