import { shuffle } from "./engine";
import type { Card } from "./types";

export const DECK_COUNT_OPTIONS = [1, 2, 4, 6, 8] as const;
export type DeckCount = (typeof DECK_COUNT_OPTIONS)[number];
export const DEFAULT_DECK_COUNT: DeckCount = 6; // casino default

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
const CARDS_PER_DECK = 52;

// Reshuffle once less than this fraction of the shoe remains (~1.5 decks
// left in a 6-deck shoe) — matches typical casino penetration.
export const PENETRATION_THRESHOLD = 0.25;

let shoeIdCounter = 0;

/** Build a shoe of `deckCount` standard decks (N copies of each card), shuffled together. */
export function createShoe(deckCount: number): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ id: `shoe-${shoeIdCounter++}`, suit, rank, faceUp: true });
      }
    }
  }
  return shuffle(shoe);
}

/** True once the shoe has been drawn down past the penetration threshold. */
export function needsReshuffle(shoeCardsLeft: number, deckCount: number): boolean {
  return shoeCardsLeft / (deckCount * CARDS_PER_DECK) < PENETRATION_THRESHOLD;
}
