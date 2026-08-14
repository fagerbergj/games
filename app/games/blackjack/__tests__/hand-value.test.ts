import { calculateHandValue, isBlackjack } from "../lib/engine";
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

  test("three cards all aces = 13",           ()    => {
    expect(calculateHandValue([card(1), card(1), card(1)])).toBe(13); });

  test("large hand bust — multiple cards >21", ()   => {
    expect(calculateHandValue([card(10), card(7), card(7)])).toBe(24); });

  test("empty hand",                   ()    => { expect(calculateHandValue([])).toBe(0); });

  test("single Ace = 11",              ()    => {
    expect(calculateHandValue([card(1)])).toBe(11); });

  test("hard sum exactly 21",          ()    => {
    expect(calculateHandValue([card(10), card(6), card(5)])).toBe(21); });

  test("soft total with a face card — A + Q = 21", ()    => {
    expect(calculateHandValue([card(1), card(12)])).toBe(21); });

  test("multiple aces and a face card — A + A + K = 12", ()   => {
    // Only one Ace can ever count as 11. One Ace=11 + other Ace=1 + K=10 would bust at 22,
    // so both Aces fall back to 1: 1 + 1 + 10 = 12.
    expect(calculateHandValue([card(1), card(1), card(13)])).toBe(12); });

  test("multiple soft aces with low card — A + A + 3 = 15", ()     => {
    expect(calculateHandValue([card(1), card(1), card(3)])).toBe(15); });

  test("soft 21 with mixed cards — A + 7 + 3 = 21", ()     => {
    expect(calculateHandValue([card(1), card(7), card(3)])).toBe(21); });

  test("A + A + 9 = 21",               ()    => {
    expect(calculateHandValue([card(1), card(1), card(9)])).toBe(21); });

  test("A + A + A + 8 = 21",           ()    => {
    expect(calculateHandValue([card(1), card(1), card(1), card(8)])).toBe(21); });
});

describe("isBlackjack", () => {
  test("Ace + King (2 cards, 21) → true",  () => {
    expect(isBlackjack([card(1), card(13)])).toBe(true); });

  test("three-card 21 is NOT blackjack (must be exactly 2 cards) — A + A + 9", () => {
    expect(isBlackjack([card(1), card(1), card(9)])).toBe(false); });

  test("three-card 21 is NOT blackjack — 7 + 7 + 7", () => {
    expect(isBlackjack([card(7), card(7), card(7)])).toBe(false); });

  test("two cards totaling less than 21 → false", () => {
    expect(isBlackjack([card(10), card(6)])).toBe(false); });
});
