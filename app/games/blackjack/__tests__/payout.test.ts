import { calculatePayout, updateBankroll } from "../lib/engine";
import { DEFAULT_HOUSE_RULES } from "../lib/houseRules";
import type { Card } from "../lib/types";

function makeHand(ranks: number[]): Card[] {
  return ranks.map((r, i) => ({ id: `c-${i}`, suit: "spades" as const, rank: r, faceUp: true }));
}

describe("calculatePayout — player natural blackjack", () => {
  test("player BJ vs non-BJ → blackjack (+150 for bet 100)", () => {
    const player   = makeHand([1, 10]);
    const dealer   = makeHand([8, 6]);
    expect(calculatePayout(player, dealer, 100)).toEqual({ result: "blackjack", amount: 150 });
  });

  test("player BJ vs also BJ → push (amount 0)", () => {
    const pj = [{ id: "x-1", suit: "diamonds" as const, rank: 1, faceUp: true }, { id: "x-2", suit: "hearts" as const, rank: 13, faceUp: true }];
    const dj = [{ id: "y-1", suit: "spades" as const,     rank: 1, faceUp: true }, { id: "y-2", suit: "clubs" as const,   rank: 12, faceUp: true }];
    expect(calculatePayout(pj, dj, 100)).toEqual({ result: "push", amount: 0 });
  });

  test("player BJ at bet 50 → blackjack (+75)", () => {
    const player = makeHand([1, 10]);
    const dealer = makeHand([2, 3]);
    expect(calculatePayout(player, dealer, 50)).toEqual({ result: "blackjack", amount: 75 });
  });

  test("player BJ at bet 250 → blackjack (+375)", () => {
    const player = makeHand([1, 10]);
    const dealer = makeHand([4, 6]);
    expect(calculatePayout(player, dealer, 250)).toEqual({ result: "blackjack", amount: 375 });
  });
});

describe("calculatePayout — exact half-dollar payouts, no rounding", () => {
  test("$25 natural at 3:2 → +37.5", () => {
    const player = makeHand([1, 10]);
    const dealer = makeHand([8, 6]);
    expect(calculatePayout(player, dealer, 25)).toEqual({ result: "blackjack", amount: 37.5 });
  });

  test("$25 natural at 6:5 → +30", () => {
    const player = makeHand([1, 10]);
    const dealer = makeHand([8, 6]);
    const rules = { ...DEFAULT_HOUSE_RULES, blackjackPayout: "6:5" as const };
    expect(calculatePayout(player, dealer, 25, rules)).toEqual({ result: "blackjack", amount: 30 });
  });
});

describe("calculatePayout — normal game results", () => {
  test("normal win (player higher, no BJ)", () => {
    const player = makeHand([10, 9]);        // 19 vs dealer 14
    const dealer = makeHand([8, 6]);
    expect(calculatePayout(player, dealer, 100)).toEqual({ result: "win", amount: 100 });
  });

  test("normal loss (dealer has higher value)", () => {
    const player = makeHand([10, 6]);        // 16 vs dealer 17
    const dealer = makeHand([10, 7]);
    expect(calculatePayout(player, dealer, 100)).toEqual({ result: "loss", amount: -100 });
  });

  test("push (same total, no BJ)", () => {
    const player = makeHand([5, 7]);         // 12 vs dealer 12
    const dealer = makeHand([3, 9]);
    expect(calculatePayout(player, dealer, 50)).toEqual({ result: "push", amount: 0 });
  });

  test("player bust → loss (-bet)", () => {
    const player = makeHand([10, 6, 6]);     // 22 (bust)
    const dealer: Card[] = [];               // dummy — busted hand always loses
    expect(calculatePayout(player, dealer, 75)).toEqual({ result: "loss", amount: -75 });
  });

  test("dealer BJ while player has no BJ → loss", () => {
    const player   = makeHand([10, 6]);      // 16 (not BJ)
    const dealer   = [{ id: "b-1", suit: "diamonds" as const, rank: 1, faceUp: true }, { id: "b-2", suit: "hearts" as const, rank: 10, faceUp: true }]; // A+J
    expect(calculatePayout(player, dealer, 100)).toEqual({ result: "loss", amount: -100 });
  });

  test("player bust beats any dealer hand → still loss", () => {
    const player   = makeHand([10, 6, 9]);   // 25 (busted)
    const dealer   = makeHand([3, 7]);       // 10 (dealer just happened to have this final state)
    expect(calculatePayout(player, dealer, 75)).toEqual({ result: "loss", amount: -75 });
  });
});

describe("calculatePayout — dealer bust", () => {
  test("dealer 22 vs player 18 → win", () => {
    const player = makeHand([10, 8]);          // 18
    const dealer = makeHand([9, 6, 7]);        // 22 (bust)
    expect(calculatePayout(player, dealer, 100)).toEqual({ result: "win", amount: 100 });
  });

  test("dealer 24 (A+3+K+K) vs player 19 → win", () => {
    // Live-bug regression: dealer bust must win for the player, not resolve as a loss.
    const player = makeHand([10, 9]);          // 19
    const dealer = makeHand([1, 3, 13, 13]);   // A+3+K+K = 24 (bust)
    expect(calculatePayout(player, dealer, 5)).toEqual({ result: "win", amount: 5 });
  });

  test("dealer 26 vs player 20 → win", () => {
    const player = makeHand([10, 10]);         // 20
    const dealer = makeHand([10, 10, 6]);      // 26 (bust)
    expect(calculatePayout(player, dealer, 50)).toEqual({ result: "win", amount: 50 });
  });

  test("both bust → player still loses (player busts first, standard rule)", () => {
    const player = makeHand([10, 6, 9]);       // 25 (bust)
    const dealer = makeHand([9, 6, 7]);        // 22 (bust)
    expect(calculatePayout(player, dealer, 75)).toEqual({ result: "loss", amount: -75 });
  });
});

describe("updateBankroll", () => {
  test("win — bankroll increases by bet",       ()   => { expect(updateBankroll(600, 100)).toBe(700); });
  test("loss — bankroll decreases by bet",      ()   => { expect(updateBankroll(500, -100)).toBe(400); });
  test("push — no change",                      ()   => { expect(updateBankroll(500, 0)).toBe(500); });
  test("blackjack win",                         ()   => { expect(updateBankroll(500, 250)).toBe(750); });
  test("overshoot — bankroll clamped at zero",  ()   => { expect(updateBankroll(30, -60)).toBe(0); });

  // Rule: a loss can never push the bankroll below zero, it floors at 0 rather than going negative.
  // In practice this never truncates a real stake, because placeBet (hooks/useBlackjack.ts) already
  // clamps every bet to at most the current bankroll before a hand is dealt.
  test("a loss larger than the bankroll floors at zero, it does not go negative", () => {
    expect(updateBankroll(20, -50)).toBe(0);
  });
});
