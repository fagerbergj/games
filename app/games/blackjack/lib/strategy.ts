import { calculateHandValue, getCardValue } from "./engine";
import type { Card } from "./types";

// Chart convention: 4-8 decks, dealer STANDS on soft 17 (S17, matches this
// game's dealerDrawRule), double on any two cards, double after split, no
// surrender. Source: blackjack-chart.com's S17 table, cross-checked against
// the two known S17/H17 deltas (11 vs A, soft-18 vs 6).

export type Action = "hit" | "stand" | "double" | "split";

export interface BookAdvice {
  /** The exact chart answer, ignoring what this game's UI currently offers. */
  book: Action;
  /** What to actually do given this game only has Hit/Stand buttons today. */
  recommended: "hit" | "stand";
  /** True when book !== recommended because double/split isn't offered yet. */
  noteUnavailable: boolean;
  /** One-sentence, situation-specific explanation of the book's reasoning. */
  reason: string;
}

function dealerLabel(d: number): string {
  return d === 1 ? "Ace" : String(d);
}

/** A hand is "soft" when one Ace is being counted as 11 rather than 1. */
function isSoftHand(hand: readonly Card[]): boolean {
  const hardTotal = hand.reduce((sum, c) => sum + (c.rank === 1 ? 1 : getCardValue(c.rank)), 0);
  return calculateHandValue([...hand]) === hardTotal + 10;
}

/* ------------------------------------------------------------------ */
/*  Chart lookups — d is the dealer upcard value: 1=Ace, 2-10          */
/* ------------------------------------------------------------------ */

function hardAction(total: number, d: number): Action {
  if (total <= 8) return "hit";
  if (total === 9) return d >= 3 && d <= 6 ? "double" : "hit";
  if (total === 10) return d >= 2 && d <= 9 ? "double" : "hit";
  if (total === 11) return d !== 1 ? "double" : "hit";
  if (total === 12) return d >= 4 && d <= 6 ? "stand" : "hit";
  if (total <= 16) return d >= 2 && d <= 6 ? "stand" : "hit";
  return "stand"; // 17+
}

function softAction(total: number, d: number): Action {
  if (total <= 14) return d === 4 || d === 5 ? "double" : "hit"; // A,2 - A,3
  if (total <= 16) return d >= 4 && d <= 6 ? "double" : "hit"; // A,4 - A,5
  if (total === 17) return d >= 3 && d <= 6 ? "double" : "hit"; // A,6
  if (total === 18) {
    if (d >= 3 && d <= 6) return "double"; // "Ds": double, else stand
    if (d === 2 || d === 7 || d === 8) return "stand";
    return "hit"; // vs 9, 10, Ace
  }
  return "stand"; // A,8 / A,9
}

function pairAction(rank: number, d: number): Action {
  if (rank === 1) return "split"; // A,A
  if (rank === 10) return "stand"; // 10,10 (any ten-value pair)
  if (rank === 9) return d === 7 || d === 10 || d === 1 ? "stand" : "split";
  if (rank === 8) return "split";
  if (rank === 7) return d >= 2 && d <= 7 ? "split" : "hit";
  if (rank === 6) return d >= 2 && d <= 6 ? "split" : "hit";
  if (rank === 5) return d >= 2 && d <= 9 ? "double" : "hit"; // never split — it's a hard 10
  if (rank === 4) return d === 5 || d === 6 ? "split" : "hit";
  return d >= 2 && d <= 7 ? "split" : "hit"; // 2,2 and 3,3
}

/* ------------------------------------------------------------------ */
/*  Reasoning — templated but parameterized by the real dealer card    */
/*  and total, so the text tracks the actual situation, not a fixed   */
/*  string.                                                             */
/* ------------------------------------------------------------------ */

function hardReason(total: number, d: number, action: Action): string {
  const dl = dealerLabel(d);
  if (total <= 8) return `Hit — ${total} can't bust on the next card, so there's no reason to stop drawing.`;
  if (total === 9)
    return action === "double"
      ? `Double — 9 against a weak dealer ${dl} is a strong spot to press the bet: you'll often improve while the dealer starts short.`
      : `Hit — 9 isn't strong enough to stand on, and dealer ${dl} is too strong a hand to double into.`;
  if (total === 10)
    return action === "double"
      ? `Double — 10 against dealer ${dl} is one of the best doubling totals: a ten-card gets you to 20 while the dealer's upcard is still weak.`
      : `Hit — 10 needs to grow, but dealer ${dl} is too strong a hand to risk doubling your bet into.`;
  if (total === 11)
    return action === "double"
      ? `Double — 11 can't bust on the next card and dealer ${dl} isn't a lock; this is the strongest doubling total in the game.`
      : `Hit — 11 is strong, but the dealer's Ace threatens blackjack, so take the card without doubling the bet.`;
  if (total === 12)
    return action === "stand"
      ? `Stand — dealer busts most often showing ${dl}; let them take the risk instead of risking your own bust on 12.`
      : `Hit — dealer ${dl} isn't weak enough to lean on; 12 busts on a ten-card either way, so take the risk yourself.`;
  if (total <= 16)
    return action === "stand"
      ? `Stand — dealer busts most often showing ${dl}; let them take the risk instead of risking your own bust on a stiff ${total}.`
      : `Hit — dealer's ${dl} makes a strong hand likely; standing on ${total} loses more often than busting costs you.`;
  return `Stand — ${total} is strong enough already; hitting risks busting for little gain.`;
}

function softReason(total: number, d: number, action: Action): string {
  const dl = dealerLabel(d);
  if (total <= 16)
    return action === "double"
      ? `Double — soft ${total} can't bust on the next card, so this is a free chance to press the bet against dealer ${dl}.`
      : `Hit — the ace means soft ${total} can never bust on one card, so keep drawing; dealer ${dl} isn't weak enough to double into.`;
  if (total === 17)
    return action === "double"
      ? `Double — soft 17 is still bust-proof on the next card, and dealer ${dl} is weak enough to press the bet.`
      : `Hit — soft 17 is too weak to stand on, and dealer ${dl} doesn't justify doubling; the ace makes hitting free.`;
  if (total === 18) {
    if (action === "double")
      return `Double (stand if double isn't offered) — soft 18 already holds up against dealer ${dl}, but the ace's safety makes pressing the bet the stronger play.`;
    if (action === "stand") return `Stand — soft 18 already holds up well against dealer ${dl}.`;
    return `Hit — soft 18 loses to a dealer ${dl}; the ace makes hitting free, since you can't bust.`;
  }
  return `Stand — soft ${total} is already a strong hand; hitting risks turning it hard for little upside.`;
}

function pairReason(rank: number, d: number, action: Action): string {
  const dl = dealerLabel(d);
  const label = rank === 1 ? "Aces" : rank === 10 ? "10s" : `${rank}s`;
  if (rank === 1) return "Split — two Aces each get their own shot at a blackjack, which beats playing a mediocre soft 12 as one hand.";
  if (rank === 10) return "Stand — 20 is one of the best hands in the game; splitting tens throws away a near-lock to chase two uncertain hands.";
  if (rank === 8) return "Split — 8,8 is a genuinely bad 16 to stand on; splitting turns the worst stiff total into two hands that start fresh.";
  if (rank === 5)
    return action === "double"
      ? `Double — a pair of 5s is really just a hard 10; never split it, press the bet into weak dealer ${dl} instead.`
      : `Hit — a pair of 5s is really just a hard 10, and dealer ${dl} is too strong a hand to double into.`;
  if (rank === 9 && action === "stand") return `Stand — 9,9 is already 18, strong enough against dealer ${dl} without breaking it up.`;
  if (action === "split") return `Split — two ${label} are a weak hand together; splitting against dealer ${dl} turns one bad hand into two live ones.`;
  return `Hit — splitting ${label} isn't worth it against dealer ${dl}; play the total as a hard hand instead.`;
}

/**
 * When the book says double/split but this game doesn't offer it, fall back
 * per the chart's own convention: "Dh"/split fall back to hit, except the
 * one "Ds" cell (soft 18 vs 3-6) which falls back to stand.
 */
function fallbackAction(book: "double" | "split", hand: readonly Card[], d: number, isPair: boolean): "hit" | "stand" {
  if (book === "split") {
    const rank = getCardValue(hand[0].rank);
    if (rank === 1) return "hit"; // A,A as a hard/soft 12 — hit is the honest fallback
    return hardAction(rank * 2, d) === "stand" ? "stand" : "hit";
  }
  const isDsCell = !isPair && isSoftHand(hand) && calculateHandValue([...hand]) === 18 && d >= 3 && d <= 6;
  return isDsCell ? "stand" : "hit";
}

export function getBookAdvice(hand: readonly Card[], dealerUpCard: Card): BookAdvice {
  const d = getCardValue(dealerUpCard.rank);
  const isPair = hand.length === 2 && getCardValue(hand[0].rank) === getCardValue(hand[1].rank);

  let book: Action;
  let reason: string;

  if (isPair) {
    const rank = getCardValue(hand[0].rank);
    book = pairAction(rank, d);
    reason = pairReason(rank, d, book);
  } else {
    const total = calculateHandValue([...hand]);
    if (isSoftHand(hand)) {
      book = softAction(total, d);
      reason = softReason(total, d, book);
    } else {
      book = hardAction(total, d);
      reason = hardReason(total, d, book);
    }
  }

  if (book === "hit" || book === "stand") {
    return { book, recommended: book, noteUnavailable: false, reason };
  }

  return { book, recommended: fallbackAction(book, hand, d, isPair), noteUnavailable: true, reason };
}
