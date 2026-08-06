import { Card } from "./types";
import type { BlackjackResult } from "./types";

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

let deckIdCounter = 0;

export function shuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `bj-${deckIdCounter++}`, suit, rank, faceUp: true });
    }
  }
  return shuffle(deck);
}

export function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function drawCard(deck: Card[]): { card: Card; remaining: Card[] } {
  const copy = [...deck];
  return { card: copy.shift()!, remaining: copy };
}

/**
 * Sum card values, treating Aces as 11 when it doesn't bust the hand.
 * Multiple aces are checked — only one counts as 11 at most.
 */
export function calculateHandValue(hand: Card[]): number {
  let value = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 1) {
      aces += 1;
    } else if (card.rank >= 11) {
      value += 10;
    } else {
      value += card.rank;
    }
  }
  for (let i = 0; i < aces; i++) {
    if (value + 11 <= 21) {
      value += 11;
    } else {
      value += 1;
    }
  }
  return value;
}

/** True when hand is exactly two cards totaling 21. */
export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

/** Returns true when the dealer must draw another card. */
export function dealerDrawRule(handValue: number): boolean {
  return handValue <= 16;
}

/** Draw cards one at a time until dealer stands (≥17). */
export function dealerDraw(
  originalDeck: Card[],
  dealerHand: Card[]
): { hand: Card[]; deck: Card[] } {
  let currenthand = [...dealerHand];
  const remainingdeck = [...originalDeck];

  while (calculateHandValue(currenthand) <= 16) {
    const next = drawCard(remainingdeck);
    currenthand.push(next.card);
  }

  return { hand: currenthand, deck: remainingdeck };
}

/** Apply net change to bankroll. */
export function updateBankroll(bankroll: number, netChange: number): number {
  return Math.max(0, bankroll + netChange);
}

/**
 * Calculate payout based on player and dealer hands (both fully revealed).
 * Returns the net change to player's bankroll.
 */
export function calculatePayout(
  playerHand: Card[],
  dealerHandRevealed: Card[],
  bet: number,
): { result: "win" | "loss" | "push" | "blackjack"; amount: number } {
  const pv = calculateHandValue(playerHand);
  const dv = calculateHandValue(dealerHandRevealed);
  const pj = isBlackjack(playerHand);
  const dj = isBlackjack(dealerHandRevealed);

  if (pj && !dj) return { result: "blackjack", amount: Math.round(bet * 1.5) };
  if (pj && dj) return { result: "push", amount: 0 };
  if (pj || pv > 21) return { result: "loss", amount: -bet };
  if (pv > dv) return { result: "win", amount: bet };
  if (dv > pv) return { result: "loss", amount: -bet };
  return { result: "push", amount: 0 };
}

export function getCardValue(rank: number): number {
  if (rank >= 11) return 10;
  return rank;
}
