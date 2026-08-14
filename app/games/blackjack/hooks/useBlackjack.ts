import { useState, useCallback, useEffect, useRef } from "react";
import {
  drawCard as engineDraw, isBlackjack, calculateHandValue, getCardValue,
  dealerDraw as engineDealerDraw, dealerUpCardCouldBeBlackjack,
  canSplit as engineCanSplit, canDoubleDown as engineCanDoubleDown, canSurrender as engineCanSurrender,
  splitHand as engineSplitHand, settleHand, evenMoneyPayout, surrenderPayout,
  calculateInsurancePayout, createHand, createSeat, updateBankroll,
} from "../lib/engine";
import { createShoe, needsReshuffle, DEFAULT_DECK_COUNT } from "../lib/shoe";
import { hiLoValue, runningCount as sumHiLo, decksRemaining as computeDecksRemaining, trueCount as computeTrueCount } from "../lib/count";
import { getSeatBankrolls, saveSeatBankrolls, STARTING_BANKROLL } from "../lib/bankroll";
import { getHouseRules, saveHouseRules, sanitizeHouseRules, DEFAULT_HOUSE_RULES } from "../lib/houseRules";
import { getDeckCount, saveDeckCount, getCountVisible, saveCountVisible } from "../lib/settings";
import type { BlackjackTableState, Seat, Hand, HouseRules, Card } from "../lib/types";

export const MIN_SEATS = 1;
export const MAX_SEATS = 5;

// Pace of the dealer's card-by-card reveal. 500-700ms reads as a deliberate
// deal without dragging; tune here if it feels off.
const REVEAL_DELAY_MS = 600;

function seatLabel(i: number): string {
  return `Seat ${i + 1}`;
}

function clampSeatCount(n: number): number {
  return Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(n)));
}

// state.deck IS the shoe's live remainder -- it's never wiped between rounds
// (resetRound only clears hands/bets/phase), so there's one source of truth
// for "what's left to deal" and nothing separate to keep in sync with it.
// Uses SSR-safe defaults only (no localStorage) so hydration matches; the
// hook's mount effect adopts every persisted value (rules, deck count, and
// each seat's own bankroll) once mounted.
function initTable(seatCount: number, rules: HouseRules, deckCount: number): BlackjackTableState {
  const count = clampSeatCount(seatCount);
  return {
    seats: Array.from({ length: count }, (_, i) => createSeat(`seat-${i}`, seatLabel(i), STARTING_BANKROLL)),
    activeSeatIndex: 0,
    dealerHand: [],
    deck: createShoe(deckCount),
    phase: "betting",
    houseRules: rules,
  };
}

/** Bankroll still uncommitted to any hand or side bet this round — what a seat can still wager. */
export function availableFunds(seat: Seat): number {
  const committed = seat.hands.reduce((sum, h) => sum + h.bet, 0) + (seat.insurance?.bet ?? 0);
  return seat.bankroll - committed;
}

function currentHand(state: BlackjackTableState): { seat: Seat; hand: Hand; seatIndex: number } | null {
  const seat = state.seats[state.activeSeatIndex];
  const hand = seat?.hands[seat.activeHandIndex];
  if (!seat || !hand) return null;
  return { seat, hand, seatIndex: state.activeSeatIndex };
}

/** What the seat currently on the clock may do with its active hand, and why not otherwise. */
export function getActiveHandActions(state: BlackjackTableState) {
  if (state.phase !== "playerTurns") return null;
  const cur = currentHand(state);
  if (!cur || cur.hand.status !== "active") return null;
  const { seat, hand } = cur;
  const rules = state.houseRules;
  const funds = availableFunds(seat);
  const splitsUsed = seat.hands.length - 1;
  const isPair = hand.cards.length === 2 && getCardValue(hand.cards[0].rank) === getCardValue(hand.cards[1].rank);

  let splitReason: string | null = null;
  if (isPair && !engineCanSplit(hand.cards, rules, splitsUsed)) {
    splitReason = rules.maxSplits === 0
      ? "splitting is disabled at this table"
      : `split limit reached (${rules.maxSplits})`;
  } else if (isPair && funds < hand.bet) {
    splitReason = "not enough bankroll to split again";
  }

  return {
    canHit: true,
    canStand: true,
    canDouble: engineCanDoubleDown(hand.cards, rules, hand.isSplitHand) && funds >= hand.bet,
    canSurrender: engineCanSurrender(rules, hand.cards, hand.isSplitHand),
    canSplit: isPair && splitReason === null,
    splitOffered: isPair,
    splitReason,
  };
}

// --- Pure state transitions -------------------------------------------------

function placeBetOn(state: BlackjackTableState, seatIndex: number, amount: number): BlackjackTableState {
  if (state.phase !== "betting") return state;
  const seat = state.seats[seatIndex];
  if (!seat) return state;
  const bet = Math.min(Math.max(1, Math.floor(amount)), seat.bankroll);
  if (bet <= 0) return state;
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, pendingBet: bet } : s));
  return { ...state, seats };
}

function setSeatCountFn(state: BlackjackTableState, n: number): BlackjackTableState {
  if (state.phase !== "betting" || state.seats.some(s => s.pendingBet > 0)) return state;
  const count = clampSeatCount(n);
  const bankrolls = getSeatBankrolls(count);
  return { ...state, seats: bankrolls.map((b, i) => createSeat(`seat-${i}`, seatLabel(i), b)) };
}

function setHouseRulesFn(state: BlackjackTableState, rules: HouseRules): BlackjackTableState {
  if (state.phase !== "betting") return state;
  const sanitized = sanitizeHouseRules(rules);
  saveHouseRules(sanitized);
  return { ...state, houseRules: sanitized };
}

/**
 * Deals every seat + the dealer off the continuing shoe. Reshuffle is only ever
 * considered here, at a round boundary -- never mid-round -- matching casino
 * practice and keeping the running count meaningful within a round.
 */
function startRound(state: BlackjackTableState, deckCount: number): BlackjackTableState {
  if (state.phase !== "betting" || state.seats.length === 0) return state;
  if (!state.seats.every(s => s.pendingBet > 0)) return state;

  let deck = needsReshuffle(state.deck.length, deckCount) ? createShoe(deckCount) : state.deck;
  const freshShoe = () => createShoe(deckCount);
  const dealt: [Card, Card][] = [];
  for (let i = 0; i < state.seats.length; i++) {
    const d1 = engineDraw(deck, freshShoe);
    const d2 = engineDraw(d1.remaining, freshShoe);
    deck = d2.remaining;
    dealt.push([{ ...d1.card, faceUp: true }, { ...d2.card, faceUp: true }]);
  }
  const dealerUp = engineDraw(deck, freshShoe);
  const dealerHole = engineDraw(dealerUp.remaining, freshShoe);
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

function takeInsurance(state: BlackjackTableState, seatIndex: number, amount: number): BlackjackTableState {
  if (state.phase !== "insurance") return state;
  const seat = state.seats[seatIndex];
  const hand = seat?.hands[0];
  if (!seat || seat.insurance || !hand) return state;
  const cap = Math.min(hand.bet / 2, availableFunds(seat));
  const bet = Math.max(0, Math.min(amount, cap));
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, insurance: { bet } } : s));
  return maybeResolveInsurancePhase({ ...state, seats });
}

function declineInsurance(state: BlackjackTableState, seatIndex: number): BlackjackTableState {
  return takeInsurance(state, seatIndex, 0);
}

function takeEvenMoney(state: BlackjackTableState, seatIndex: number): BlackjackTableState {
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

function hit(state: BlackjackTableState, deckCount: number): BlackjackTableState {
  const cur = currentHand(state);
  if (state.phase !== "playerTurns" || !cur || cur.hand.status !== "active") return state;
  const { seat, hand, seatIndex } = cur;
  // The penetration floor keeps every round's starting shoe well above what a
  // round can consume, so this fallback should be unreachable -- if it fires,
  // that's a bug in the threshold, not something to hide.
  const drawn = engineDraw(state.deck, () => {
    console.error("blackjack: shoe exhausted mid-round -- penetration threshold gave insufficient headroom");
    return createShoe(deckCount);
  });
  const cards = [...hand.cards, drawn.card];
  const value = calculateHandValue(cards);
  const updatedHand: Hand = { ...hand, cards, status: value > 21 ? "busted" : value === 21 ? "stood" : "active" };
  const hands = seat.hands.map((h, i) => (i === seat.activeHandIndex ? updatedHand : h));
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, hands } : s));
  return advanceIfCurrentHandTerminal({ ...state, seats, deck: drawn.remaining });
}

function doubleDown(state: BlackjackTableState, deckCount: number): BlackjackTableState {
  const cur = currentHand(state);
  if (state.phase !== "playerTurns" || !cur || cur.hand.status !== "active") return state;
  const { seat, hand, seatIndex } = cur;
  const rules = state.houseRules;
  if (!engineCanDoubleDown(hand.cards, rules, hand.isSplitHand) || availableFunds(seat) < hand.bet) return state;

  const drawn = engineDraw(state.deck, () => createShoe(deckCount));
  const cards = [...hand.cards, drawn.card];
  const value = calculateHandValue(cards);
  const updatedHand: Hand = { ...hand, cards, bet: hand.bet * 2, status: value > 21 ? "busted" : "doubled" };
  const hands = seat.hands.map((h, i) => (i === seat.activeHandIndex ? updatedHand : h));
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, hands } : s));
  return advanceIfCurrentHandTerminal({ ...state, seats, deck: drawn.remaining });
}

function stand(state: BlackjackTableState): BlackjackTableState {
  const cur = currentHand(state);
  if (state.phase !== "playerTurns" || !cur || cur.hand.status !== "active") return state;
  const { seat, seatIndex } = cur;
  const hands = seat.hands.map((h, i) => (i === seat.activeHandIndex ? { ...h, status: "stood" as const } : h));
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, hands } : s));
  return advanceIfCurrentHandTerminal({ ...state, seats });
}

function split(state: BlackjackTableState): BlackjackTableState {
  const cur = currentHand(state);
  if (state.phase !== "playerTurns" || !cur || cur.hand.status !== "active") return state;
  const { seat, hand, seatIndex } = cur;
  const rules = state.houseRules;
  const splitsUsed = seat.hands.length - 1;
  if (!engineCanSplit(hand.cards, rules, splitsUsed) || availableFunds(seat) < hand.bet) return state;

  const { hands: [a, b], deck } = engineSplitHand(hand, state.deck);
  const oneCardOnly = a.isSplitAces && rules.splitAcesOneCardOnly;
  const handA = oneCardOnly ? { ...a, status: "stood" as const } : a;
  const handB = oneCardOnly ? { ...b, status: "stood" as const } : b;

  const idx = seat.activeHandIndex;
  const hands = [...seat.hands.slice(0, idx), handA, handB, ...seat.hands.slice(idx + 1)];
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, hands } : s));
  return advanceIfCurrentHandTerminal({ ...state, seats, deck });
}

function surrender(state: BlackjackTableState): BlackjackTableState {
  const cur = currentHand(state);
  if (state.phase !== "playerTurns" || !cur || cur.hand.status !== "active") return state;
  const { seat, hand, seatIndex } = cur;
  if (!engineCanSurrender(state.houseRules, hand.cards, hand.isSplitHand)) return state;

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
 * Pure — computes the dealer's full final hand and every seat's settlement. Does not
 * touch React state; the reveal effect below decides how to unveil it over time.
 */
function finishDealerAndSettle(state: BlackjackTableState): BlackjackTableState {
  const revealed = state.dealerHand.map(c => ({ ...c, faceUp: true }));
  const anyHandNeedsPlay = state.seats.some(seat => seat.hands.some(handNeedsDealerPlay));

  // Busted/surrendered hands never need the dealer's total, and a natural's payout is fixed
  // the moment the hole card is known — drawing further would just be dealer theater.
  const drawn = anyHandNeedsPlay
    ? engineDealerDraw(state.deck, revealed, state.houseRules)
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
function resetRound(state: BlackjackTableState): BlackjackTableState {
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

function resetSeatBankrollFn(state: BlackjackTableState, seatIndex: number): BlackjackTableState {
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, bankroll: STARTING_BANKROLL } : s));
  saveSeatBankrolls(seats.map(s => s.bankroll));
  return { ...state, seats };
}

/**
 * Buy-back-in for a seat that's dropped below the smallest chip and can no longer
 * bet at all. Only offered at the betting phase; also reshuffles the shared shoe,
 * since a mid-round top-up would be an undeserved bailout.
 */
function buyBackInFn(state: BlackjackTableState, seatIndex: number, deckCount: number): BlackjackTableState {
  if (state.phase !== "betting") return state;
  const seats = state.seats.map((s, i) => (i === seatIndex ? { ...s, bankroll: STARTING_BANKROLL } : s));
  saveSeatBankrolls(seats.map(s => s.bankroll));
  return { ...state, seats, deck: createShoe(deckCount) };
}

// --- The hook ----------------------------------------------------------------

/** Hook that manages a multi-seat blackjack table: N seats, one dealer, one continuing shoe. */
export function useBlackjack(initialSeatCount = 1) {
  // Initial state must match SSR (no localStorage access) to avoid a hydration
  // mismatch; the mount effect below adopts every persisted value.
  const [deckCount, setDeckCountState] = useState<number>(DEFAULT_DECK_COUNT);
  const [state, setState] = useState<BlackjackTableState>(() => initTable(initialSeatCount, DEFAULT_HOUSE_RULES, DEFAULT_DECK_COUNT));

  // Identifies the "live" round. Reveal timers compare against this before touching
  // state, so a reset mid-reveal can't resurrect a stale round's cards or payout.
  const handIdRef = useRef(0);

  // --- Card-counting state ---
  const [justReshuffled, setJustReshuffled] = useState(false);
  const [runningCountValue, setRunningCountValue] = useState(0);
  const [lastCountedCard, setLastCountedCard] = useState<{ card: Card; delta: number } | undefined>();
  const [countVisible, setCountVisibleState] = useState<boolean>(false);
  const countedIds = useRef<Set<string>>(new Set());

  // Adopt persisted values once mounted -- the initial render above uses SSR-safe
  // defaults so hydration matches, this pulls in the real values (house rules,
  // deck count, count visibility, and each seat's own stored bankroll).
  useEffect(() => {
    const storedDeckCount = getDeckCount();
    const storedCountVisible = getCountVisible();
    const storedRules = getHouseRules();
    const storedBankrolls = getSeatBankrolls(initialSeatCount);
    const nothingStored = storedDeckCount === DEFAULT_DECK_COUNT
      && !storedCountVisible
      && storedRules === DEFAULT_HOUSE_RULES // getHouseRules returns this exact reference when nothing's saved
      && storedBankrolls.every(b => b === STARTING_BANKROLL);
    if (nothingStored) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate one-time hydration adoption of browser-only values, not a data-fetch loop
    setDeckCountState(storedDeckCount);
    setCountVisibleState(storedCountVisible);
    setState(prev => ({
      ...prev,
      deck: createShoe(storedDeckCount),
      houseRules: storedRules,
      seats: prev.seats.map((s, i) => ({ ...s, bankroll: storedBankrolls[i] ?? s.bankroll })),
    }));
  }, [initialSeatCount]);

  // Persist every seat's bankroll once a round settles.
  useEffect(() => {
    if (state.phase === "result") saveSeatBankrolls(state.seats.map(s => s.bankroll));
  }, [state.phase, state.seats]);

  // Card counting is decoupled from every draw/reveal call site: whenever a previously-unseen
  // card becomes face-up anywhere at the table (any seat's hand or the dealer's), tag it once
  // by id. This stays correct regardless of the paced dealer reveal or how many seats are live.
  useEffect(() => {
    const visible = [
      ...state.seats.flatMap(s => s.hands.flatMap(h => h.cards)),
      ...state.dealerHand,
    ].filter(c => c.faceUp);
    const fresh = visible.filter(c => !countedIds.current.has(c.id));
    if (fresh.length === 0) return;
    for (const c of fresh) countedIds.current.add(c.id);
    setRunningCountValue(rc => rc + sumHiLo(fresh));
    const last = fresh[fresh.length - 1];
    setLastCountedCard({ card: last, delta: hiLoValue(last.rank) });
  }, [state]);

  // Draws the dealer's finished hand card by card, then applies the full settlement.
  // Fires once per round entering dealerTurn (keyed on phase alone, not the whole
  // state, so the reveal's own ticks don't re-trigger it). Cleanup clears any
  // un-fired timers on unmount or when phase moves on for any reason.
  useEffect(() => {
    if (state.phase !== "dealerTurn") return;

    const myHandId = handIdRef.current;
    const settled = finishDealerAndSettle(state);
    const extraCards = settled.dealerHand.slice(state.dealerHand.length);
    const timers: ReturnType<typeof setTimeout>[] = [];

    extraCards.forEach((card, i) => {
      timers.push(setTimeout(() => {
        if (handIdRef.current !== myHandId) return;
        setState(s => (s.phase === "dealerTurn" ? { ...s, dealerHand: [...s.dealerHand, card] } : s));
      }, REVEAL_DELAY_MS * (i + 1)));
    });

    // Guaranteed to reach "result" even if a step is somehow skipped, since every
    // tick is its own fixed-delay timer rather than a chain a dropped callback could strand.
    timers.push(setTimeout(() => {
      if (handIdRef.current !== myHandId) return;
      setState(s => (s.phase === "dealerTurn" ? settled : s));
    }, REVEAL_DELAY_MS * (extraCards.length + 1)));

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on phase alone: the reveal's own ticks change dealerHand but must not re-trigger this effect
  }, [state.phase]);

  const setDeckCount = useCallback((n: number) => {
    saveDeckCount(n);
    setDeckCountState(n);
    setRunningCountValue(0);
    setLastCountedCard(undefined);
    countedIds.current.clear();
    setState(prev => (prev.phase === "betting" ? { ...prev, deck: createShoe(n) } : prev));
  }, []);

  const toggleCountVisible = useCallback(() => {
    setCountVisibleState(v => {
      const next = !v;
      saveCountVisible(next);
      return next;
    });
  }, []);

  const placeBet = useCallback((seatIndex: number, amount: number) => setState(s => placeBetOn(s, seatIndex, amount)), []);
  const setSeatCount = useCallback((n: number) => setState(s => setSeatCountFn(s, n)), []);
  const setHouseRules = useCallback((rules: HouseRules) => setState(s => setHouseRulesFn(s, rules)), []);

  const startRoundAction = useCallback(() => {
    setState(s => {
      if (s.phase !== "betting") return s;
      const reshuffling = needsReshuffle(s.deck.length, deckCount);
      if (reshuffling) {
        setRunningCountValue(0);
        setLastCountedCard(undefined);
        countedIds.current.clear();
      }
      setJustReshuffled(reshuffling);
      return startRound(s, deckCount);
    });
  }, [deckCount]);

  // No Deal button: the moment every seat has a committed wager, deal. startRoundAction
  // already no-ops outside the betting phase, so a stray re-run here is harmless.
  useEffect(() => {
    if (state.phase === "betting" && state.seats.length > 0 && state.seats.every(s => s.pendingBet > 0)) {
      startRoundAction();
    }
  }, [state, startRoundAction]);

  const hitAction = useCallback(() => setState(s => hit(s, deckCount)), [deckCount]);
  const standAction = useCallback(() => setState(stand), []);
  const doubleAction = useCallback(() => setState(s => doubleDown(s, deckCount)), [deckCount]);
  const splitAction = useCallback(() => setState(split), []);
  const surrenderAction = useCallback(() => setState(surrender), []);
  const takeInsuranceAction = useCallback((seatIndex: number, amount: number) => setState(s => takeInsurance(s, seatIndex, amount)), []);
  const declineInsuranceAction = useCallback((seatIndex: number) => setState(s => declineInsurance(s, seatIndex)), []);
  const takeEvenMoneyAction = useCallback((seatIndex: number) => setState(s => takeEvenMoney(s, seatIndex)), []);
  const resetRoundAction = useCallback(() => {
    handIdRef.current += 1;
    setState(resetRound);
  }, []);
  const resetSeatBankroll = useCallback((seatIndex: number) => setState(s => resetSeatBankrollFn(s, seatIndex)), []);
  const buyBackIn = useCallback((seatIndex: number) => {
    setState(s => buyBackInFn(s, seatIndex, deckCount));
    setRunningCountValue(0);
    setLastCountedCard(undefined);
    countedIds.current.clear();
  }, [deckCount]);

  const decksLeft = computeDecksRemaining(state.deck.length);
  const trueCountValue = computeTrueCount(runningCountValue, decksLeft);

  return {
    state,
    placeBet,
    setSeatCount,
    setHouseRules,
    startRound: startRoundAction,
    hit: hitAction,
    stand: standAction,
    double: doubleAction,
    split: splitAction,
    surrender: surrenderAction,
    takeInsurance: takeInsuranceAction,
    declineInsurance: declineInsuranceAction,
    takeEvenMoney: takeEvenMoneyAction,
    resetRound: resetRoundAction,
    resetSeatBankroll,
    buyBackIn,
    actions: getActiveHandActions(state),
    deckCount,
    setDeckCount,
    justReshuffled,
    runningCount: runningCountValue,
    trueCount: trueCountValue,
    decksRemaining: decksLeft,
    lastCountedCard,
    countVisible,
    toggleCountVisible,
  };
}
