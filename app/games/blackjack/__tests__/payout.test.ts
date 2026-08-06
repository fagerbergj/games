import { calculatePayout, updateBankroll } from "../lib/engine";
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

describe("updateBankroll", () => {
  test("win — bankroll increases by bet",       ()   => { expect(updateBankroll(600, 100)).toBe(700); });
  test("loss — bankroll decreases by bet",      ()   => { expect(updateBankroll(500, -100)).toBe(400); });
  test("push — no change",                      ()   => { expect(updateBankroll(500, 0)).toBe(500); });
  test("blackjack win",                         ()   => { expect(updateBankroll(500, 250)).toBe(750); });
  test("overshoot — bankroll clamped at zero",  ()   => { expect(updateBankroll(30, -60)).toBe(0); });
});
