export interface Card {
  id: string;
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  rank: number;
  faceUp: boolean;
}

export interface BlackjackResult {
  result: "win" | "loss" | "push" | "blackjack" | "surrender" | "even-money";
  amount: number;
}

/**
 * One table's toggleable house rules. Defaults match a common Vegas 6-deck S17 shoe game
 * (see lib/houseRules.ts for sourcing). The engine reads every field here — no rule is
 * ever hardcoded past this object.
 */
export interface HouseRules {
  /** Dealer hits (true, "H17") or stands (false, "S17") on a soft 17. */
  dealerHitsSoft17: boolean;
  /** Natural blackjack payout: 3:2 is standard, 6:5 is worse for the player. */
  blackjackPayout: "3:2" | "6:5";
  /** Double down allowed after splitting a pair (DAS). */
  doubleAfterSplit: boolean;
  /** Double down on any first two cards, or only on hard 9/10/11. */
  doubleRestriction: "any2" | "9-11";
  /** No surrender, or late surrender (forfeit half the bet, after the dealer checks for blackjack). */
  surrender: "none" | "late";
  /** Offer insurance (and even money on a player blackjack) when the dealer shows an ace. */
  insuranceEnabled: boolean;
  /** How many times a hand may be split, 0-3. 3 splits = 4 hands, the common casino cap. */
  maxSplits: number;
  /** Split aces receive exactly one more card each, then stand automatically. */
  splitAcesOneCardOnly: boolean;
  /** When the dealer checks the hole card for blackjack. */
  dealerPeek: "peek" | "noPeek" | "enhc";
}

export type HandStatus =
  | "active"
  | "stood"
  | "busted"
  | "doubled"
  | "surrendered"
  | "settled";

/** A single playable hand. A seat holds more than one of these once it splits. */
export interface Hand {
  id: string;
  cards: Card[];
  bet: number;
  status: HandStatus;
  isSplitHand: boolean;
  /** Originated from splitting a pair of aces — governs the one-card rule. */
  isSplitAces: boolean;
  result?: BlackjackResult;
}

export interface InsuranceState {
  bet: number;
  result?: "win" | "loss";
}

/** One player at the table: its own bankroll, bet, and (after splits) hand list. */
export interface Seat {
  id: string;
  label: string;
  bankroll: number;
  /** The seat's chosen wager during the "betting" phase, before hands[0] exists. */
  pendingBet: number;
  hands: Hand[];
  activeHandIndex: number;
  insurance: InsuranceState | null;
  evenMoneyTaken: boolean;
  /** True once this seat has no more hands left to act on this round. */
  done: boolean;
}

export type TablePhase =
  | "betting"
  | "insurance"
  | "playerTurns"
  | "dealerTurn"
  | "result";

export interface BlackjackTableState {
  seats: Seat[];
  activeSeatIndex: number;
  dealerHand: Card[];
  deck: Card[];
  phase: TablePhase;
  houseRules: HouseRules;
}
