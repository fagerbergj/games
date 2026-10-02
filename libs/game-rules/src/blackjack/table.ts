import {
  drawCard, isBlackjack, calculateHandValue, getCardValue, dealerDraw, dealerUpCardCouldBeBlackjack,
  canSplit, canDoubleDown, canSurrender, splitHand, settleHand, evenMoneyPayout, surrenderPayout,
  calculateInsurancePayout, createHand, createSeat, shuffledDeck, updateBankroll,
} from "./engine";
import { createShoe, needsReshuffle } from "./shoe";
import { sanitizeHouseRules } from "./houseRules";
import type { BlackjackTableState, Seat, Hand, HouseRules, Card, Rng } from "./types";

export const STARTING_BANKROLL = 500;
export const MIN_SEATS = 1;
export const MAX_SEATS = 5;

function seatLabel(i: number): string {
  return `Seat ${i + 1}`;
}

function clampSeatCount(n: number): number {
  return Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(n)));
}

// state.deck IS the shoe's live remainder -- it's never wiped between rounds
// (resetRound only clears hands/bets/phase), so there's one source of truth
// for "what's left to deal" and nothing separate to keep in sync with it.
export function createTable(seatCount: number, rules: HouseRules, deckCount: number, rng: Rng): BlackjackTableState {
  const count = clampSeatCount(seatCount);
  return {
    seats: Array.from({ length: count }, (_, i) => createSeat(`seat-${i}`, seatLabel(i), STARTING_BANKROLL)),
    activeSeatIndex: 0,
    dealerHand: [],
    deck: createShoe(deckCount, rng),
    phase: "betting",
    houseRules: rules,
  };
}

/** Bankroll still uncommitted to any hand or side bet this round — what a seat can still wager. */
export function availableFunds(seat: Seat): number {
  const committed = seat.hands.reduce((sum, h) => sum + h.bet, 0) + (seat.insurance?.bet ?? 0);
  return seat.bankroll - committed;
}

export function currentHand(state: BlackjackTableState): { seat: Seat; hand: Hand; seatIndex: number } | null {
  const seat = state.seats[state.activeSeatIndex];
  const hand = seat?.hands[seat.activeHandIndex];
  if (!seat || !hand) return null;
  return { seat, hand, seatIndex: state.activeSeatIndex };
}

/** What the seat currently on the clock may do with its active hand, and why not otherwise. */
export function getActiveHandActions(state: BlackjackTableState) {
  if (state.phase !== "playerTurns") return null;
  const cur = currentHand(state);
  // A one-card hand is still waiting for its deal (see the pending-deal effect), so no actions yet.
  if (!cur || cur.hand.status !== "active" || cur.hand.cards.length < 2) return null;
  const { seat, hand } = cur;
  const rules = state.houseRules;
  const funds = availableFunds(seat);
  const splitsUsed = seat.hands.length - 1;
  const isPair = hand.cards.length === 2 && getCardValue(hand.cards[0].rank) === getCardValue(hand.cards[1].rank);

  let splitReason: string | null = null;
  if (isPair && !canSplit(hand.cards, rules, splitsUsed)) {
    splitReason = rules.maxSplits === 0
      ? "splitting is disabled at this table"
      : `split limit reached (${rules.maxSplits})`;
  } else if (isPair && funds < hand.bet) {
    splitReason = "not enough bankroll to split again";
  }

  return {
    canHit: true,
    canStand: true,
    canDouble: canDoubleDown(hand.cards, rules, hand.isSplitHand) && funds >= hand.bet,
    canSurrender: canSurrender(rules, hand.cards, hand.isSplitHand),
    canSplit: isPair && splitReason === null,
    splitOffered: isPair,
    splitReason,
  };
}

// --- State transitions: each returns the next state, or the same object when the action is illegal now.

export function placeBet(state: BlackjackTableState, seatIndex: number, amount: number): BlackjackTableState {
  if (state.phase !== "betting") return state;
  const seat = state.seats[seatIndex];
  if (!seat) return state;
  const bet = Math.min(Math.max(1, Math.floor(amount)), seat.bankroll);
  if (bet <= 0) return state;
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, pendingBet: bet } : s));
  return { ...state, seats };
}

/** `bankrolls[i]` seeds seat i; seats beyond it start at STARTING_BANKROLL. */
export function setSeatCount(state: BlackjackTableState, n: number, bankrolls: readonly number[] = []): BlackjackTableState {
  if (state.phase !== "betting" || state.seats.some(s => s.pendingBet > 0)) return state;
  const seats = Array.from({ length: clampSeatCount(n) }, (_, i) =>
    createSeat(`seat-${i}`, seatLabel(i), bankrolls[i] ?? STARTING_BANKROLL));
  return { ...state, seats };
}

export function setHouseRules(state: BlackjackTableState, rules: HouseRules): BlackjackTableState {
  if (state.phase !== "betting") return state;
  return { ...state, houseRules: sanitizeHouseRules(rules) };
}

/**
 * Deals every seat + the dealer off the continuing shoe. Reshuffle is only ever
 * considered here, at a round boundary -- never mid-round -- matching casino
 * practice and keeping the running count meaningful within a round.
 */
export function startRound(state: BlackjackTableState, deckCount: number, rng: Rng): BlackjackTableState {
  if (state.phase !== "betting" || state.seats.length === 0) return state;
  if (!state.seats.every(s => s.pendingBet > 0)) return state;

  let deck = needsReshuffle(state.deck.length, deckCount) ? createShoe(deckCount, rng) : state.deck;
  const freshShoe = () => createShoe(deckCount, rng);
  const dealt: [Card, Card][] = [];
  for (let i = 0; i < state.seats.length; i++) {
    const d1 = drawCard(deck, freshShoe);
    const d2 = drawCard(d1.remaining, freshShoe);
    deck = d2.remaining;
    dealt.push([{ ...d1.card, faceUp: true }, { ...d2.card, faceUp: true }]);
  }
  const dealerUp = drawCard(deck, freshShoe);
  const dealerHole = drawCard(dealerUp.remaining, freshShoe);
  deck = dealerHole.remaining;
  const dealerHand = [{ ...dealerUp.card, faceUp: true }, { ...dealerHole.card, faceUp: false }];

  const seats = state.seats.map((seat, i) => {
    const cards = dealt[i];
    const hand = createHand(cards, seat.pendingBet, isBlackjack(cards) ? { status: "stood" } : {});
    return {
      ...seat, hands: [hand], pendingBet: 0, activeHandIndex: 0, done: false, insurance: null,
      evenMoneyTaken: false, lastWager: seat.pendingBet,
    };
  });

  const dealtState: BlackjackTableState = { ...state, seats, dealerHand, deck, activeSeatIndex: 0, phase: "playerTurns" };

  const offerInsurance = state.houseRules.insuranceEnabled && dealerHand[0].rank === 1;
  return offerInsurance ? { ...dealtState, phase: "insurance" } : resolvePreplay(dealtState);
}

function resolveSeatInsurance(seat: Seat, dealerHasBlackjack: boolean): Seat {
  if (!seat.insurance || seat.insurance.result) return seat;
  return { ...seat, insurance: { ...seat.insurance, result: dealerHasBlackjack ? "win" : "loss" } };
}

/** Runs the dealer's peek (if the rules call for one) and either ends the round or opens play. */
function resolvePreplay(state: BlackjackTableState): BlackjackTableState {
  const rules = state.houseRules;
  const dealerUp = state.dealerHand[0];
  const shouldPeek = rules.dealerPeek === "peek" && dealerUp && dealerUpCardCouldBeBlackjack(dealerUp);

  if (!shouldPeek) {
    return advanceIfCurrentHandTerminal({ ...state, phase: "playerTurns", activeSeatIndex: 0 });
  }

  const dealerHasBlackjack = isBlackjack(state.dealerHand);
  const seats = state.seats.map(s => resolveSeatInsurance(s, dealerHasBlackjack));

  if (dealerHasBlackjack) {
    // Dealer's natural ends the round before anyone acts — same reveal path as a normal stand.
    return enterDealerTurn({ ...state, seats });
  }
  return advanceIfCurrentHandTerminal({ ...state, seats, phase: "playerTurns", activeSeatIndex: 0 });
}

function maybeResolveInsurancePhase(state: BlackjackTableState): BlackjackTableState {
  if (state.phase !== "insurance") return state;
  if (!state.seats.every(s => s.insurance !== null)) return state;
  return resolvePreplay(state);
}

export function takeInsurance(state: BlackjackTableState, seatIndex: number, amount: number): BlackjackTableState {
  if (state.phase !== "insurance") return state;
  const seat = state.seats[seatIndex];
  const hand = seat?.hands[0];
  if (!seat || seat.insurance || !hand) return state;
  const cap = Math.min(hand.bet / 2, availableFunds(seat));
  const bet = Math.max(0, Math.min(amount, cap));
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, insurance: { bet } } : s));
  return maybeResolveInsurancePhase({ ...state, seats });
}

export function declineInsurance(state: BlackjackTableState, seatIndex: number): BlackjackTableState {
  return takeInsurance(state, seatIndex, 0);
}

export function takeEvenMoney(state: BlackjackTableState, seatIndex: number): BlackjackTableState {
  if (state.phase !== "insurance") return state;
  const seat = state.seats[seatIndex];
  const hand = seat?.hands[0];
  if (!seat || seat.insurance || !hand || !isBlackjack(hand.cards)) return state;
  const settledHand: Hand = { ...hand, status: "settled", result: evenMoneyPayout(hand.bet) };
  const seats = state.seats.map((s, i) =>
    i === seatIndex ? { ...s, hands: [settledHand], insurance: { bet: 0 }, evenMoneyTaken: true } : s
  );
  return maybeResolveInsurancePhase({ ...state, seats });
}

function findNextActive(
  seats: Seat[], fromSeat: number, fromHandExclusive = -1,
): { seatIndex: number; handIndex: number } | null {
  for (let si = fromSeat; si < seats.length; si++) {
    const startHand = si === fromSeat ? fromHandExclusive + 1 : 0;
    const hi = seats[si].hands.findIndex((h, i) => i >= startHand && h.status === "active");
    if (hi !== -1) return { seatIndex: si, handIndex: hi };
  }
  return null;
}

/** Flips the dealer's hole card face up and hands control to the dealer's turn — the reveal effect finishes it. */
function enterDealerTurn(state: BlackjackTableState): BlackjackTableState {
  const [up, hole] = state.dealerHand;
  const dealerHand = hole ? [up, { ...hole, faceUp: true }] : state.dealerHand;
  return { ...state, dealerHand, phase: "dealerTurn" };
}

/** Id of the split hand on the clock that still waits for its second card, else null. */
export function pendingDealHandId(state: BlackjackTableState): string | null {
  const hand = state.phase === "playerTurns" ? currentHand(state)?.hand : undefined;
  return hand?.cards.length === 1 ? hand.id : null;
}

/**
 * A freshly-activated split hand carries only its original card until play
 * reaches it; the caller deals its second card one beat later with this, matching
 * the physical deal where a split hand gets its next card only when it's on the clock.
 */
export function dealSecondCardIfNeeded(state: BlackjackTableState, rng: Rng): BlackjackTableState {
  const cur = currentHand(state);
  if (!cur || cur.hand.cards.length !== 1) return state;
  const { seat, hand, seatIndex } = cur;
  const drawn = drawCard(state.deck, () => shuffledDeck(rng));
  const cards = [...hand.cards, drawn.card];
  const value = calculateHandValue(cards);
  const updatedHand: Hand = { ...hand, cards, status: value === 21 || isOneCardSplitAces(hand, state.houseRules) ? "stood" : "active" };
  const hands = seat.hands.map((h, i) => (i === seat.activeHandIndex ? updatedHand : h));
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, hands } : s));
  return advanceIfCurrentHandTerminal({ ...state, seats, deck: drawn.remaining });
}

function isOneCardSplitAces(hand: Hand, rules: HouseRules): boolean {
  return hand.isSplitAces && rules.splitAcesOneCardOnly;
}

/** After any action that can end a hand's turn, seeks the next hand entitled to act, or ends the round. */
function advanceIfCurrentHandTerminal(state: BlackjackTableState): BlackjackTableState {
  if (state.phase !== "playerTurns") return state;
  const seat = state.seats[state.activeSeatIndex];
  const hand = seat?.hands[seat.activeHandIndex];
  if (hand && hand.status === "active") return state;
  if (!seat) return enterDealerTurn(state);

  const withinSeat = findNextActive([seat], 0, seat.activeHandIndex);
  if (withinSeat) {
    const seats = state.seats.map((s, i) =>
      i === state.activeSeatIndex ? { ...s, activeHandIndex: withinSeat.handIndex } : s
    );
    return { ...state, seats };
  }

  const seatsMarked = state.seats.map((s, i) => (i === state.activeSeatIndex ? { ...s, done: true } : s));
  const next = findNextActive(seatsMarked, state.activeSeatIndex + 1);
  if (next) {
    const seats = seatsMarked.map((s, i) =>
      i === next.seatIndex ? { ...s, activeHandIndex: next.handIndex } : s
    );
    return { ...state, seats, activeSeatIndex: next.seatIndex };
  }

  return enterDealerTurn({ ...state, seats: seatsMarked });
}

export function hit(state: BlackjackTableState, deckCount: number, rng: Rng): BlackjackTableState {
  const cur = currentHand(state);
  if (state.phase !== "playerTurns" || !cur || cur.hand.status !== "active") return state;
  const { seat, hand, seatIndex } = cur;
  // The penetration floor keeps every round's starting shoe well above what a
  // round can consume, so this fallback should be unreachable -- if it fires,
  // that's a bug in the threshold, not something to hide.
  const drawn = drawCard(state.deck, () => {
    console.error("blackjack: shoe exhausted mid-round -- penetration threshold gave insufficient headroom");
    return createShoe(deckCount, rng);
  });
  const cards = [...hand.cards, drawn.card];
  const value = calculateHandValue(cards);
  const updatedHand: Hand = { ...hand, cards, status: value > 21 ? "busted" : value === 21 ? "stood" : "active" };
  const hands = seat.hands.map((h, i) => (i === seat.activeHandIndex ? updatedHand : h));
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, hands } : s));
  return advanceIfCurrentHandTerminal({ ...state, seats, deck: drawn.remaining });
}

export function doubleDown(state: BlackjackTableState, deckCount: number, rng: Rng): BlackjackTableState {
  const cur = currentHand(state);
  if (state.phase !== "playerTurns" || !cur || cur.hand.status !== "active") return state;
  const { seat, hand, seatIndex } = cur;
  const rules = state.houseRules;
  if (!canDoubleDown(hand.cards, rules, hand.isSplitHand) || availableFunds(seat) < hand.bet) return state;

  const drawn = drawCard(state.deck, () => createShoe(deckCount, rng));
  const cards = [...hand.cards, drawn.card];
  const value = calculateHandValue(cards);
  const updatedHand: Hand = { ...hand, cards, bet: hand.bet * 2, status: value > 21 ? "busted" : "doubled" };
  const hands = seat.hands.map((h, i) => (i === seat.activeHandIndex ? updatedHand : h));
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, hands } : s));
  return advanceIfCurrentHandTerminal({ ...state, seats, deck: drawn.remaining });
}

export function stand(state: BlackjackTableState): BlackjackTableState {
  const cur = currentHand(state);
  if (state.phase !== "playerTurns" || !cur || cur.hand.status !== "active") return state;
  const { seat, seatIndex } = cur;
  const hands = seat.hands.map((h, i) => (i === seat.activeHandIndex ? { ...h, status: "stood" as const } : h));
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, hands } : s));
  return advanceIfCurrentHandTerminal({ ...state, seats });
}

export function split(state: BlackjackTableState, rng: Rng): BlackjackTableState {
  const cur = currentHand(state);
  if (state.phase !== "playerTurns" || !cur || cur.hand.status !== "active") return state;
  const { seat, hand, seatIndex } = cur;
  const rules = state.houseRules;
  const splitsUsed = seat.hands.length - 1;
  if (!canSplit(hand.cards, rules, splitsUsed) || availableFunds(seat) < hand.bet) return state;

  const { hands: [a, b], deck } = splitHand(hand, state.deck, rng);
  const handA: Hand = isOneCardSplitAces(a, rules) || calculateHandValue(a.cards) === 21 ? { ...a, status: "stood" } : a;

  const idx = seat.activeHandIndex;
  const hands = [...seat.hands.slice(0, idx), handA, b, ...seat.hands.slice(idx + 1)];
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, hands } : s));
  return advanceIfCurrentHandTerminal({ ...state, seats, deck });
}

export function surrender(state: BlackjackTableState): BlackjackTableState {
  const cur = currentHand(state);
  if (state.phase !== "playerTurns" || !cur || cur.hand.status !== "active") return state;
  const { seat, hand, seatIndex } = cur;
  if (!canSurrender(state.houseRules, hand.cards, hand.isSplitHand)) return state;

  const updatedHand: Hand = { ...hand, status: "surrendered", result: surrenderPayout(hand.bet) };
  const hands = seat.hands.map((h, i) => (i === seat.activeHandIndex ? updatedHand : h));
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, hands } : s));
  return advanceIfCurrentHandTerminal({ ...state, seats });
}

/** A hand whose outcome still hinges on the dealer's actual drawn total — not already decided. */
function handNeedsDealerPlay(hand: Hand): boolean {
  if (hand.status !== "stood" && hand.status !== "doubled") return false;
  return !(isBlackjack(hand.cards) && !hand.isSplitHand);
}

/**
 * Computes the dealer's full final hand and every seat's settlement in one step;
 * the caller decides how to unveil the extra dealer cards over time.
 */
export function finishDealerAndSettle(state: BlackjackTableState, rng: Rng): BlackjackTableState {
  const revealed = state.dealerHand.map(c => ({ ...c, faceUp: true }));
  const anyHandNeedsPlay = state.seats.some(seat => seat.hands.some(handNeedsDealerPlay));

  // Busted/surrendered hands never need the dealer's total, and a natural's payout is fixed
  // the moment the hole card is known — drawing further would just be dealer theater.
  const drawn = anyHandNeedsPlay
    ? dealerDraw(state.deck, revealed, state.houseRules, rng)
    : { hand: revealed, deck: state.deck };

  const dealerHand = drawn.hand.map(c => ({ ...c, faceUp: true }));
  return settleRound({ ...state, dealerHand, deck: drawn.deck });
}

function settleRound(state: BlackjackTableState): BlackjackTableState {
  const rules = state.houseRules;
  const dealerHand = state.dealerHand;
  const dealerHasBlackjack = isBlackjack(dealerHand);

  const seats = state.seats.map(seat => {
    const hands = seat.hands.map(h => (h.result ? h : { ...h, result: settleHand(h, dealerHand, rules) }));
    const handsNet = hands.reduce((sum, h) => sum + (h.result?.amount ?? 0), 0);
    const seatWithInsurance = resolveSeatInsurance(seat, dealerHasBlackjack);
    const insuranceNet = seatWithInsurance.insurance
      ? calculateInsurancePayout(seatWithInsurance.insurance.bet, dealerHand)
      : 0;
    const bankroll = updateBankroll(seat.bankroll, handsNet + insuranceNet);
    return { ...seat, hands, insurance: seatWithInsurance.insurance, bankroll, done: true };
  });

  return { ...state, seats, phase: "result" };
}

/** Keeps the continuing shoe (deck) across rounds -- only setDeckCount or a reshuffle rebuilds it. */
export function resetRound(state: BlackjackTableState): BlackjackTableState {
  return {
    ...state,
    seats: state.seats.map(s => ({
      ...s, pendingBet: 0, hands: [], activeHandIndex: 0, insurance: null, evenMoneyTaken: false, done: false,
    })),
    activeSeatIndex: 0,
    dealerHand: [],
    phase: "betting",
  };
}

export function resetSeatBankroll(state: BlackjackTableState, seatIndex: number): BlackjackTableState {
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, bankroll: STARTING_BANKROLL } : s));
  return { ...state, seats };
}

/**
 * Buy-back-in for a seat that's dropped below the smallest chip and can no longer
 * bet at all. Only offered at the betting phase; also reshuffles the shared shoe,
 * since a mid-round top-up would be an undeserved bailout.
 */
export function buyBackIn(state: BlackjackTableState, seatIndex: number, deckCount: number, rng: Rng): BlackjackTableState {
  if (state.phase !== "betting") return state;
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, bankroll: STARTING_BANKROLL } : s));
  return { ...state, seats, deck: createShoe(deckCount, rng) };
}
