import type { Card } from "./types";

const CARDS_PER_DECK = 52;
// Floor for the true-count divisor — avoids wild swings as the shoe empties
// toward the reshuffle point, standard casual-counting practice.
const MIN_DECKS_REMAINING = 0.5;

/** Hi-Lo tag for a single rank: 2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1. */
export function hiLoValue(rank: number): -1 | 0 | 1 {
  if (rank >= 2 && rank <= 6) return 1;
  if (rank >= 7 && rank <= 9) return 0;
  return -1;
}

export function rankLabel(rank: number): string {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

/** Running count: sum of Hi-Lo tags over every card that has been seen. */
export function runningCount(seen: readonly Card[]): number {
  return seen.reduce((sum, c) => sum + hiLoValue(c.rank), 0);
}

/** Decks left in the shoe, floored to keep the true-count divisor sane near empty. */
export function decksRemaining(shoeCardsLeft: number): number {
  return Math.max(shoeCardsLeft / CARDS_PER_DECK, MIN_DECKS_REMAINING);
}

/** True count = running ÷ decks remaining, rounded to the nearest half (our convention). */
export function trueCount(running: number, decksLeft: number): number {
  const raw = running / Math.max(decksLeft, MIN_DECKS_REMAINING);
  return Math.round(raw * 2) / 2;
}

/** One-line teaching gloss for what the current true count means for betting/play. */
export function countMeaning(tc: number): string {
  if (tc <= -1) return "Shoe is small-card heavy — the house edge is at its worst here.";
  if (tc >= 2) return "Shoe is rich in tens: dealer busts more, blackjacks pay you more — this is when a counter raises the bet.";
  return "Neutral shoe — play the book.";
}
