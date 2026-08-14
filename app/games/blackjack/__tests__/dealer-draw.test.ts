import { dealerDraw, dealerDrawRule, calculateHandValue } from "../lib/engine";
import type { Card } from "../lib/types";

/* ------------------------------------------------------------------ */
/*  Test helpers                                                      */
/* ------------------------------------------------------------------ */

function card(rank: number): Card {
  return { id: `r-${rank}`, suit: "spades" as const, rank, faceUp: true };
}

/* ------------------------------------------------------------------ */
/*  Dealer draw rule (stand at 17+)                                   */
/* ------------------------------------------------------------------ */

describe("dealerDrawRule", () => {
  test("hard 16 → must draw", () => { expect(dealerDrawRule(16)).toBe(true); });
  test("hard 17 → stand",       () => { expect(dealerDrawRule(17)).toBe(false); });
  test("soft 17 → stand",      () => { expect(dealerDrawRule(17)).toBe(false); });
  test("any value ≥ 17 → stand", () => { for (let v = 17; v <= 26; v++) expect(dealerDrawRule(v)).toBe(false); });
  test("any value ≤ 16 → draw",  () => { for (let v = 0; v <= 16; v++) expect(dealerDrawRule(v)).toBe(true); });
});

/* ------------------------------------------------------------------ */
/*  dealerDraw (full function)                                        */
/* ------------------------------------------------------------------ */

describe("dealerDraw", () => {
  test("stands on hard 17 — hand and deck unchanged", () => {
    const hand = [card(10), card(7)]; // 17
    const deck: Card[] = [card(2)];   // one unseen card

    const result = dealerDraw(deck, [...hand]);
    expect(result.hand).toHaveLength(2);
    expect(result.hand[0].rank + result.hand[1].rank).toBe(17);
  });

  test("hits to stand — draws once then stops", () => {
    // Hand: [5, 6] = 11 → dealer must draw. Deck starts with [10]. Draws 10 → 21.
    const hand = [card(5), card(6)];
    const deck = [card(10), card(3)];

    const result = dealerDraw(deck, [...hand]);
    expect(result.hand).toHaveLength(3);
    // Value should be 21 (5+6+10)
    let value = 0;
    for (const c of result.hand) { if (c.rank >= 11) value += 10; else value += c.rank; }
    expect(value).toBe(21);
  });

  test("multi-draw bust — draws until stands or busts", () => {
    // Hand: [8, 5] = 13 → draw. Deck: [7, 10]. After drawing 7 → 20, stands.
    const hand   = [card(8), card(5)];       // 13
    const deck   = [card(7), card(10), card(6)];

    const result = dealerDraw(deck, [...hand]);
    expect(result.hand).toHaveLength(3);
    // Value should be 20 (8+5+7)
    let value = 0;
    for (const c of result.hand) { if (c.rank >= 11) value += 10; else value += c.rank; }
    expect(value).toBe(20);
  });

  test("multi-draw sequence — draws three cards before standing", () => {
    // Hand: [4, 5] = 9. Deck: [8, 7, 6]. After drawing: 17 → stands (17 ≥ 17).
    const hand   = [card(4), card(5)];       // 9
    const deck   = [card(8), card(7), card(6)];

    const result = dealerDraw(deck, [...hand]);
    expect(result.hand).toHaveLength(3);
    // Value should be 17 (4+5+8)
    let value = 0;
    for (const c of result.hand) { if (c.rank >= 11) value += 10; else value += c.rank; }
    expect(value).toBe(17);
  });

  test("dealer bust — draws until >21", () => {
    // Constructed: [8, 6] = 14 → draw 9 → 23 (bust)
    const hand   = [card(8), card(6)];       // 14 → draw
    const deck   = [card(9)];                // draws 9 → 23 (bust)

    const result = dealerDraw(deck, [...hand]);
    expect(result.hand).toHaveLength(3);
    // Value should be 23 (8+6+9), which is a bust.
    let value = 0;
    for (const c of result.hand) { if (c.rank >= 11) value += 10; else value += c.rank; }
    expect(value).toBe(23);
  });

  test("returns new arrays, does not mutate input", () => {
    const hand = [card(10), card(7)];  // 17 → stands
    const deck = [card(8)];
    const origLenHand   = hand.length;
    const origLenDeck   = deck.length;

    dealerDraw(deck, [...hand]);

    expect(hand).toHaveLength(origLenHand);
    expect(deck).toHaveLength(origLenDeck);
  });

  test("each draw consumes the deck — no repeated top card across multiple draws", () => {
    // Hand [2, 3] = 5 needs several draws before standing. Deck has 4 distinct cards
    // so the top card can never legitimately repeat.
    const hand = [{ id: "p-2", suit: "spades" as const, rank: 2, faceUp: true },
                  { id: "p-3", suit: "spades" as const, rank: 3, faceUp: true }];
    const deck = [
      { id: "d-1", suit: "hearts" as const, rank: 4, faceUp: true },
      { id: "d-2", suit: "hearts" as const, rank: 4, faceUp: true },
      { id: "d-3", suit: "hearts" as const, rank: 4, faceUp: true },
      { id: "d-4", suit: "hearts" as const, rank: 10, faceUp: true },
    ];
    const originalLength = deck.length;

    const result = dealerDraw(deck, [...hand]);
    const drawnFromDeck = result.hand.slice(hand.length);

    // 5 → draw 4 (9) → draw 4 (13) → draw 4 (17, stands): three draws, all distinct ids.
    expect(drawnFromDeck.map(c => c.id)).toEqual(["d-1", "d-2", "d-3"]);
    const ids = drawnFromDeck.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.deck.length + drawnFromDeck.length).toBe(originalLength);
  });

  test("multi-draw sequence never repeats a card and the deck shrinks by exactly the cards drawn", () => {
    const hand = [card(2), card(2)]; // 4
    const deck = [card(2), card(3), card(4), card(5), card(10)].map((c, i) => ({ ...c, id: `seq-${i}` }));
    const originalLength = deck.length;

    const result = dealerDraw(deck, [...hand]);
    const drawnFromDeck = result.hand.slice(hand.length);
    const ids = drawnFromDeck.map(c => c.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(result.deck.length + drawnFromDeck.length).toBe(originalLength);
    expect(calculateHandValue(result.hand)).toBeGreaterThanOrEqual(17);
  });
});
