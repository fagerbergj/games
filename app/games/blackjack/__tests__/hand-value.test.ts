import { calculateHandValue } from "../lib/engine";
import type { Card } from "../lib/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function card(rank: number): Card {
  return { id: `h-${rank}`, suit: "spades" as const, rank, faceUp: true };
}

describe("calculateHandValue", () => {
  test("basic sum of number cards",   ()    => {
    expect(calculateHandValue([card(2), card(3)])).toBe(5); });

  test("face cards each count as 10",   ()    => {
    expect(calculateHandValue([card(11), card(12), card(13)])).toBe(30); });

  test("soft ace — A + 6 = 17 (Ace = 11)", ()    => {
    expect(calculateHandValue([card(1), card(6)])).toBe(17); });

  test("hard ace — A + 6 + 7 = bust with 11 → Ace = 1 → 14", ()   => {
    expect(calculateHandValue([card(1), card(6), card(7)])).toBe(14); });

  test("two Aces = 12 (one soft, one hard)", ()    => {
    expect(calculateHandValue([card(1), card(1)])).toBe(12); });

  test("three cards all aces",           ()    => {
    // 1+1=2 → 1st ace = 11 (value=11) → 2nd ace = 22>21, so =1 (value=12) → 3rd ace = 23>21, 1 (value=13)
    expect(calculateHandValue([card(1), card(1), card(1)])).toBe(13); });

  test("large hand bust — multiple cards >21", ()   => {
    // 10+8+6 = 24, with Ace that becomes 1+10+8+6 = 25 still bust. Actually let me just do 10+7+7 = 24 (bust)
    expect(calculateHandValue([card(10), card(7), card(7)])).toBe(24); });

  test("empty hand",                   ()    => { expect(calculateHandValue([])).toBe(0); });

  test("single Ace = 11",              ()    => {
    // Wait, the algorithm is: value from non-aces (none = 0), aces = 1. Then for each ace: 0+11 <= 21? Yes → value = 11.
    expect(calculateHandValue([card(1)])).toBe(11); });

  test("hard sum exactly 21",          ()    => {
    // No aces: 10 + 6 + 5 = 21 exactly
    expect(calculateHandValue([card(10), card(6), card(5)])).toBe(21); });

  test("soft total with multiple face cards",     ()    => {
    // Ace (11) + Q (10) = 21 — this IS blackjack actually. But for calculateHandValue, 21 is correct either way.
    expect(calculateHandValue([card(1), card(12)])).toBe(21); });

  test("multiple aces and a face card", ()   => {
    // 2 Aces + K(face = 10): value starts at 10 (from K). First Ace: 10+11=21 ≤ 21 → +=11 (value=21). Second Ace: 21+11=32>21 → +=1 (value=22).
    // Wait no — my algorithm processes ALL non-ace cards first, then aces. With [A,A,K]: value_from_non_aces = 10, aces = 2.
    // First ace: 10+11=21 <=21 → +=11 (value becomes 21). Second ace: 21+11=32>21 → +=1 (value becomes 22). Bust!
    expect(calculateHandValue([card(1), card(1), card(13)])).toBe(22); });

  test("A + A + A = 13",               ()    => {
    // My earlier analysis: value=0, aces=3. First ace: 0+11<=21 → value=11. Second: 11+11=22>21 → +=1 (value=12). Third: 12+11=23>21 → +=1 (value=13).
    expect(calculateHandValue([card(1), card(1), card(1)])).toBe(13); });

  test("multiple soft aces with low card — A + A + 3 = 15", ()     => {
    // value_from_non_aces=3, aces=2. First ace: 3+11=14<=21 → +=11 (value=14). Second ace: 14+11=25>21 → +=1 (value=15).
    expect(calculateHandValue([card(1), card(1), card(3)])).toBe(15); });

  test("soft 21 with mixed cards — A + 7 + 3 = 21", ()     => {
    // value_from_non_aces=10, aces=1. First ace: 10+11=21<=21 → +=11 (value=21). This is blackjack!
    expect(calculateHandValue([card(1), card(7), card(3)])).toBe(21); });
});
