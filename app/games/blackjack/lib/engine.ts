import { Card, Hand, Seat, HouseRules } from "./types";
import type { BlackjackResult } from "./types";
import { DEFAULT_HOUSE_RULES } from "./houseRules";

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

export function drawCard(
  deck: Card[],
  createDeckFn: () => Card[] = shuffledDeck,
): { card: Card; remaining: Card[] } {
  const copy = [...deck];
  if (copy.length === 0) {
    return drawCard(createDeckFn(), createDeckFn);
  }
  const card = copy.shift()!;
  return { card, remaining: copy };
}

export function getCardValue(rank: number): number {
  if (rank >= 11) return 10;
  return rank;
}

/**
 * Sum card values, treating Aces as 11 when it doesn't bust the hand.
 * Only one Ace can ever be worth 11 (two would already total 22 alone),
 * so count every Ace as 1 first, then upgrade a single one if it fits.
 */
export function calculateHandValue(hand: Card[]): number {
  let value = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 1) {
      aces += 1;
      value += 1;
    } else {
      value += getCardValue(card.rank);
    }
  }
  if (aces > 0 && value + 10 <= 21) {
    value += 10;
  }
  return value;
}

/** True when an Ace in the hand is currently counted as 11. */
export function isSoftHand(hand: Card[]): boolean {
  let value = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 1) {
      aces += 1;
      value += 1;
    } else {
      value += getCardValue(card.rank);
    }
  }
  return aces > 0 && value + 10 <= 21;
}

/** True when hand is exactly two cards totaling 21. */
export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

/**
 * Returns true when the dealer must draw another card.
 * `isSoft` and `rules` are optional so existing single-value callers keep behaving
 * like a stand-on-17 (S17) game — the pre-house-rules default.
 */
export function dealerDrawRule(
  handValue: number,
  isSoft = false,
  rules: HouseRules = DEFAULT_HOUSE_RULES,
): boolean {
  if (handValue < 17) return true;
  if (handValue === 17 && isSoft && rules.dealerHitsSoft17) return true;
  return false;
}

/** Draw cards one at a time until the dealer stands, per the table's soft-17 rule. */
export function dealerDraw(
  originalDeck: Card[],
  dealerHand: Card[],
  rules: HouseRules = DEFAULT_HOUSE_RULES,
): { hand: Card[]; deck: Card[] } {
  const currenthand = [...dealerHand];
  let remainingdeck = [...originalDeck];

  while (dealerDrawRule(calculateHandValue(currenthand), isSoftHand(currenthand), rules)) {
    const next = drawCard(remainingdeck);
    currenthand.push(next.card);
    remainingdeck = next.remaining; // drawCard is pure — must reassign or the same top card redraws forever
  }

  return { hand: currenthand, deck: remainingdeck };
}

/** Apply net change to bankroll. */
export function updateBankroll(bankroll: number, netChange: number): number {
  return Math.max(0, bankroll + netChange);
}

/**
 * Calculate payout based on player and dealer hands (both fully revealed).
 * Returns the net change to player's bankroll. `isSplitHand` hands never pay the
 * blackjack bonus — a 21 from a split pair is just 21, paid at 1:1.
 */
export function calculatePayout(
  playerHand: Card[],
  dealerHandRevealed: Card[],
  bet: number,
  rules: HouseRules = DEFAULT_HOUSE_RULES,
  options: { isSplitHand?: boolean } = {},
): BlackjackResult {
  const pv = calculateHandValue(playerHand);
  const dv = calculateHandValue(dealerHandRevealed);
  const pj = !options.isSplitHand && isBlackjack(playerHand);
  const dj = isBlackjack(dealerHandRevealed);
  const blackjackMultiplier = rules.blackjackPayout === "6:5" ? 1.2 : 1.5;

  if (pj && !dj) return { result: "blackjack", amount: bet * blackjackMultiplier };
  if (pj && dj) return { result: "push", amount: 0 };
  if (pv > 21) return { result: "loss", amount: -bet };
  if (dv > 21) return { result: "win", amount: bet };
  if (pv > dv) return { result: "win", amount: bet };
  if (dv > pv) return { result: "loss", amount: -bet };
  return { result: "push", amount: 0 };
}

/** Net change from an even-money offer: locks in a 1:1 payout on a player blackjack. */
export function evenMoneyPayout(bet: number): BlackjackResult {
  return { result: "even-money", amount: bet };
}

/** Net change to bankroll for a late surrender: half the bet back, half forfeited. */
export function surrenderPayout(bet: number): BlackjackResult {
  return { result: "surrender", amount: -(bet / 2) };
}

/** Insurance pays 2:1 when the dealer has a natural, otherwise the side bet is lost. */
export function calculateInsurancePayout(insuranceBet: number, dealerHand: Card[]): number {
  return isBlackjack(dealerHand) ? insuranceBet * 2 : -insuranceBet;
}

/** True only when the dealer's up card is an ace — the sole card that offers insurance. */
export function dealerUpCardIsAce(dealerUpCard: Card): boolean {
  return dealerUpCard.rank === 1;
}

/** Ace or ten-value — the only up cards that can complete a dealer blackjack. */
export function dealerUpCardCouldBeBlackjack(dealerUpCard: Card): boolean {
  return dealerUpCard.rank === 1 || getCardValue(dealerUpCard.rank) === 10;
}

/**
 * Two cards can be split when they share a point value (e.g. 10-Jack counts, matching
 * standard casino practice) and the seat hasn't already hit the configured split cap.
 */
export function canSplit(hand: Card[], rules: HouseRules, splitsUsed: number): boolean {
  return (
    hand.length === 2 &&
    getCardValue(hand[0].rank) === getCardValue(hand[1].rank) &&
    splitsUsed < rules.maxSplits
  );
}

export function canDoubleDown(hand: Card[], rules: HouseRules, isSplitHand: boolean): boolean {
  if (hand.length !== 2) return false;
  if (isSplitHand && !rules.doubleAfterSplit) return false;
  if (rules.doubleRestriction === "any2") return true;
  const v = calculateHandValue(hand);
  return v === 9 || v === 10 || v === 11;
}

/**
 * Late surrender is only offered on an original (non-split), untouched two-card hand —
 * a hand that's been hit no longer has 2 cards, so that alone rules out "already acted".
 */
export function canSurrender(rules: HouseRules, hand: Card[], isSplitHand: boolean): boolean {
  return rules.surrender === "late" && !isSplitHand && hand.length === 2;
}

export function createHand(cards: Card[], bet: number, overrides: Partial<Hand> = {}): Hand {
  return {
    id: `hand-${deckIdCounter++}`,
    cards,
    bet,
    status: "active",
    isSplitHand: false,
    isSplitAces: false,
    ...overrides,
  };
}

export function createSeat(id: string, label: string, bankroll: number): Seat {
  return {
    id,
    label,
    bankroll,
    pendingBet: 0,
    hands: [],
    activeHandIndex: 0,
    insurance: null,
    evenMoneyTaken: false,
    done: false,
  };
}

/**
 * Split a two-card pair into two one-card hands, then deal each its second card —
 * mirrors the physical deal. Split aces are flagged so callers can apply the
 * one-card rule; caller is responsible for validating canSplit first.
 */
export function splitHand(hand: Hand, deck: Card[]): { hands: [Hand, Hand]; deck: Card[] } {
  const [cardA, cardB] = hand.cards;
  const draw1 = drawCard(deck);
  const draw2 = drawCard(draw1.remaining);
  const isAceSplit = cardA.rank === 1;

  const handA = createHand([cardA, draw1.card], hand.bet, {
    id: `${hand.id}-a`, isSplitHand: true, isSplitAces: isAceSplit,
  });
  const handB = createHand([cardB, draw2.card], hand.bet, {
    id: `${hand.id}-b`, isSplitHand: true, isSplitAces: isAceSplit,
  });

  return { hands: [handA, handB], deck: draw2.remaining };
}

/** Resolve one hand's outcome (surrender is already resolved and just passed through). */
export function settleHand(hand: Hand, dealerHand: Card[], rules: HouseRules): BlackjackResult {
  if (hand.result) return hand.result;
  return calculatePayout(hand.cards, dealerHand, hand.bet, rules, { isSplitHand: hand.isSplitHand });
}
