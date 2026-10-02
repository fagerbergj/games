import { useState, useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  createTable, placeBet as placeBetOn, setSeatCount as setSeatCountOn, setHouseRules as setHouseRulesOn,
  startRound, hit, doubleDown, stand, split, surrender, takeInsurance, declineInsurance, takeEvenMoney,
  dealSecondCardIfNeeded, pendingDealHandId, finishDealerAndSettle, resetRound, resetSeatBankroll as resetSeatBankrollOn,
  buyBackIn as buyBackInOn, getActiveHandActions, createShoe, needsReshuffle, DEFAULT_DECK_COUNT, DEFAULT_HOUSE_RULES,
  STARTING_BANKROLL, MAX_SEATS, hiLoValue, runningCount as sumHiLo, decksRemaining as computeDecksRemaining,
  trueCount as computeTrueCount, type BlackjackTableState, type HouseRules, type Card, type Rng,
} from "@game-rules/blackjack";
import { getSeatBankrolls, saveSeatBankrolls } from "../lib/bankroll";
import { getHouseRules, saveHouseRules } from "../lib/houseRules";
import { getDeckCount, saveDeckCount, getCountVisible, saveCountVisible } from "../lib/settings";

// Pace of the dealer's card-by-card reveal. 500-700ms reads as a deliberate
// deal without dragging; tune here if it feels off.
const REVEAL_DELAY_MS = 600;

const rng: Rng = Math.random;

type SetTable = Dispatch<SetStateAction<BlackjackTableState>>;
type RoundRef = MutableRefObject<number>;

/** Applies `fn` and persists the result only when the table actually accepted the change. */
function applyAndSave(setState: SetTable, fn: (s: BlackjackTableState) => BlackjackTableState, save: (s: BlackjackTableState) => void) {
  setState(prev => {
    const next = fn(prev);
    if (next !== prev) save(next);
    return next;
  });
}

const saveBankrolls = (s: BlackjackTableState) => saveSeatBankrolls(s.seats.map(seat => seat.bankroll));

// Adopt persisted values once mounted -- the initial render uses SSR-safe
// defaults so hydration matches, this pulls in the real values (house rules,
// deck count, count visibility, and each seat's own stored bankroll).
function useAdoptStoredSettings(
  initialSeatCount: number,
  setDeckCountState: Dispatch<SetStateAction<number>>,
  setCountVisibleState: Dispatch<SetStateAction<boolean>>,
  setState: SetTable,
) {
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
    setDeckCountState(storedDeckCount);
    setCountVisibleState(storedCountVisible);
    setState(prev => ({
      ...prev,
      deck: createShoe(storedDeckCount, rng),
      houseRules: storedRules,
      seats: prev.seats.map((s, i) => ({ ...s, bankroll: storedBankrolls[i] ?? s.bankroll })),
    }));
  }, [initialSeatCount, setDeckCountState, setCountVisibleState, setState]);
}

// Card counting is decoupled from every draw/reveal call site: whenever a previously-unseen
// card becomes face-up anywhere at the table (any seat's hand or the dealer's), tag it once
// by id. This stays correct regardless of the paced dealer reveal or how many seats are live.
function useCardCount(state: BlackjackTableState) {
  const [runningCount, setRunningCount] = useState(0);
  const [lastCountedCard, setLastCountedCard] = useState<{ card: Card; delta: number } | undefined>();
  const countedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const visible = [
      ...state.seats.flatMap(s => s.hands.flatMap(h => h.cards)),
      ...state.dealerHand,
    ].filter(c => c.faceUp);
    const fresh = visible.filter(c => !countedIds.current.has(c.id));
    if (fresh.length === 0) return;
    for (const c of fresh) countedIds.current.add(c.id);
    setRunningCount(rc => rc + sumHiLo(fresh));
    const last = fresh[fresh.length - 1];
    setLastCountedCard({ card: last, delta: hiLoValue(last.rank) });
  }, [state]);

  const resetCount = useCallback(() => {
    setRunningCount(0);
    setLastCountedCard(undefined);
    countedIds.current.clear();
  }, []);

  return { runningCount, lastCountedCard, resetCount };
}

// Draws the dealer's finished hand card by card, then applies the full settlement.
// Fires once per round entering dealerTurn (keyed on phase alone, not the whole
// state, so the reveal's own ticks don't re-trigger it). Cleanup clears any
// un-fired timers on unmount or when phase moves on for any reason.
function useDealerReveal(state: BlackjackTableState, setState: SetTable, roundRef: RoundRef) {
  useEffect(() => {
    if (state.phase !== "dealerTurn") return;

    const myRound = roundRef.current;
    const settled = finishDealerAndSettle(state, rng);
    const extraCards = settled.dealerHand.slice(state.dealerHand.length);
    const timers: ReturnType<typeof setTimeout>[] = [];

    extraCards.forEach((card, i) => {
      timers.push(setTimeout(() => {
        if (roundRef.current !== myRound) return;
        setState(s => (s.phase === "dealerTurn" ? { ...s, dealerHand: [...s.dealerHand, card] } : s));
      }, REVEAL_DELAY_MS * (i + 1)));
    });

    // Guaranteed to reach "result" even if a step is somehow skipped, since every
    // tick is its own fixed-delay timer rather than a chain a dropped callback could strand.
    timers.push(setTimeout(() => {
      if (roundRef.current !== myRound) return;
      setState(s => (s.phase === "dealerTurn" ? settled : s));
    }, REVEAL_DELAY_MS * (extraCards.length + 1)));

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on phase alone: the reveal's own ticks change dealerHand but must not re-trigger this effect
  }, [state.phase]);
}

// A split hand's second card is dealt a beat after play reaches it, not with the split.
function usePendingDeal(state: BlackjackTableState, setState: SetTable, roundRef: RoundRef) {
  const waitingId = pendingDealHandId(state);
  useEffect(() => {
    if (!waitingId) return;
    const myRound = roundRef.current;
    const t = setTimeout(() => {
      if (roundRef.current === myRound) setState(s => dealSecondCardIfNeeded(s, rng));
    }, REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, [waitingId, setState, roundRef]);
}

/** Dispatchers that each apply one table transition. */
function useTableActions(setState: SetTable, deckCount: number) {
  return {
    placeBet: useCallback((seatIndex: number, amount: number) => setState(s => placeBetOn(s, seatIndex, amount)), [setState]),
    setSeatCount: useCallback((n: number) => setState(s => setSeatCountOn(s, n, getSeatBankrolls(MAX_SEATS))), [setState]),
    setHouseRules: useCallback((rules: HouseRules) =>
      applyAndSave(setState, s => setHouseRulesOn(s, rules), s => saveHouseRules(s.houseRules)), [setState]),
    hit: useCallback(() => setState(s => hit(s, deckCount, rng)), [setState, deckCount]),
    stand: useCallback(() => setState(stand), [setState]),
    double: useCallback(() => setState(s => doubleDown(s, deckCount, rng)), [setState, deckCount]),
    split: useCallback(() => setState(s => split(s, rng)), [setState]),
    surrender: useCallback(() => setState(surrender), [setState]),
    takeInsurance: useCallback((seatIndex: number, amount: number) => setState(s => takeInsurance(s, seatIndex, amount)), [setState]),
    declineInsurance: useCallback((seatIndex: number) => setState(s => declineInsurance(s, seatIndex)), [setState]),
    takeEvenMoney: useCallback((seatIndex: number) => setState(s => takeEvenMoney(s, seatIndex)), [setState]),
    resetSeatBankroll: useCallback((seatIndex: number) =>
      applyAndSave(setState, s => resetSeatBankrollOn(s, seatIndex), saveBankrolls), [setState]),
  };
}

/** Hook that manages a multi-seat blackjack table: N seats, one dealer, one continuing shoe. */
export function useBlackjack(initialSeatCount = 1) {
  // Initial state must match SSR (no localStorage access) to avoid a hydration
  // mismatch; useAdoptStoredSettings adopts every persisted value after mount.
  const [deckCount, setDeckCountState] = useState<number>(DEFAULT_DECK_COUNT);
  const [countVisible, setCountVisibleState] = useState<boolean>(false);
  const [state, setState] = useState<BlackjackTableState>(() => createTable(initialSeatCount, DEFAULT_HOUSE_RULES, DEFAULT_DECK_COUNT, rng));
  const [justReshuffled, setJustReshuffled] = useState(false);

  // Identifies the "live" round. Reveal timers compare against this before touching
  // state, so a reset mid-reveal can't resurrect a stale round's cards or payout.
  const roundRef = useRef(0);

  useAdoptStoredSettings(initialSeatCount, setDeckCountState, setCountVisibleState, setState);

  // Persist every seat's bankroll once a round settles.
  useEffect(() => {
    if (state.phase === "result") saveSeatBankrolls(state.seats.map(s => s.bankroll));
  }, [state.phase, state.seats]);

  const { runningCount, lastCountedCard, resetCount } = useCardCount(state);
  useDealerReveal(state, setState, roundRef);
  usePendingDeal(state, setState, roundRef);
  const tableActions = useTableActions(setState, deckCount);

  const setDeckCount = useCallback((n: number) => {
    saveDeckCount(n);
    setDeckCountState(n);
    resetCount();
    setState(prev => (prev.phase === "betting" ? { ...prev, deck: createShoe(n, rng) } : prev));
  }, [resetCount]);

  const toggleCountVisible = useCallback(() => {
    setCountVisibleState(v => {
      const next = !v;
      saveCountVisible(next);
      return next;
    });
  }, []);

  const startRoundAction = useCallback(() => {
    setState(s => {
      if (s.phase !== "betting") return s;
      const reshuffling = needsReshuffle(s.deck.length, deckCount);
      if (reshuffling) resetCount();
      setJustReshuffled(reshuffling);
      return startRound(s, deckCount, rng);
    });
  }, [deckCount, resetCount]);

  // No Deal button: the moment every seat has a committed wager, deal. startRoundAction
  // already no-ops outside the betting phase, so a stray re-run here is harmless.
  useEffect(() => {
    if (state.phase === "betting" && state.seats.length > 0 && state.seats.every(s => s.pendingBet > 0)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the deal reacts to the last seat's bet landing; any seat's placeBet can be the trigger
      startRoundAction();
    }
  }, [state, startRoundAction]);

  const resetRoundAction = useCallback(() => {
    roundRef.current += 1;
    setState(resetRound);
  }, []);
  const buyBackIn = useCallback((seatIndex: number) => {
    applyAndSave(setState, s => buyBackInOn(s, seatIndex, deckCount, rng), saveBankrolls);
    resetCount();
  }, [deckCount, resetCount]);

  const decksLeft = computeDecksRemaining(state.deck.length);

  return {
    state,
    ...tableActions,
    startRound: startRoundAction,
    resetRound: resetRoundAction,
    buyBackIn,
    actions: getActiveHandActions(state),
    deckCount,
    setDeckCount,
    justReshuffled,
    runningCount,
    trueCount: computeTrueCount(runningCount, decksLeft),
    decksRemaining: decksLeft,
    lastCountedCard,
    countVisible,
    toggleCountVisible,
  };
}
