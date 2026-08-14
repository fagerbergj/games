import { useState, useCallback, useEffect, useRef } from "react";
import {
  drawCard as engineDraw, isBlackjack, calculateHandValue,
  dealerDraw as engineDealerDraw, updateBankroll, calculatePayout,
} from "../lib/engine";
import { createShoe, needsReshuffle, DEFAULT_DECK_COUNT } from "../lib/shoe";
import { hiLoValue, runningCount as sumHiLo, decksRemaining as computeDecksRemaining, trueCount as computeTrueCount } from "../lib/count";
import { getBankroll, saveBankroll, DEFAULT_BANKROLL } from "../lib/bankroll";
import { getDeckCount, saveDeckCount, getCountVisible, saveCountVisible } from "../lib/settings";
import type { Card, BlackjackState, GamePhase } from "../lib/types";

const STORAGE_KEY = "blackjack_bankroll";

// Pace of the dealer's card-by-card reveal (item 7). 500-700ms reads as a
// deliberate deal without dragging; tune here if it feels off.
const REVEAL_DELAY_MS = 600;

interface Outcome {
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  resultType: "win" | "loss" | "push" | "blackjack";
  amount: number;
}

// Pure — draws the dealer's full final hand and computes payout. Does not
// touch React state; the reveal effect decides how to unveil it over time.
function computeResult(
  playerCards: readonly Card[],
  deck: readonly Card[],
  dealerCards: readonly Card[],
  bet: number,
): Outcome {
  const drawn = engineDealerDraw([...deck], [...dealerCards]);

  const payout = calculatePayout([...playerCards], drawn.hand, bet);

  return {
    playerHand: Array.from(playerCards),
    dealerHand: drawn.hand,
    deck: [...drawn.deck],
    resultType: payout.result,
    amount: payout.amount,
  };
}

// Flips the hole card and hands control to the dealer's turn. The reveal
// effect (keyed on phase === "dealerTurn") takes it from here.
function flipHoleAndEnterDealerTurn(prev: BlackjackState): BlackjackState {
  const flippedHole: Card = { ...prev.dealerHand[1], faceUp: true };
  return { ...prev, dealerHand: [prev.dealerHand[0], flippedHole], phase: "dealerTurn" as GamePhase };
}

// Called after placeBet to peek at hole card and check for instant blackjack.
function peekResolve(prev: BlackjackState | null): BlackjackState | null {
  if (!prev) return prev;

  const flippedHole: Card = { ...prev.dealerHand[1], faceUp: true };
  const flipped: Card[] = [prev.dealerHand[0], flippedHole];
  const pj = isBlackjack(prev.playerHand);
  const dj = isBlackjack(flipped);

  // Either side has a natural blackjack — hand ends now, via the same
  // reveal path stand() uses (dealer may still owe a card per house rules).
  if (pj || dj) {
    return { ...prev, dealerHand: flipped, phase: "dealerTurn" as GamePhase };
  }

  // Neither BJ — hole card stays hidden, player acts next.
  return { ...prev, phase: "playerTurn" as GamePhase };
}

// Called after hit() to check if the new hand busts or hits 21.
function checkBust(prev: BlackjackState | null): BlackjackState | null {
  if (!prev || prev.phase !== "playerTurn") return prev;
  const val = calculateHandValue(prev.playerHand);
  if (val > 21) {
    // Bust ends the hand immediately — dealer doesn't draw, just flips.
    const flippedHole: Card = { ...prev.dealerHand[1], faceUp: true };
    return {
      ...prev,
      dealerHand: [prev.dealerHand[0], flippedHole],
      phase: "result" as GamePhase,
      bankroll: updateBankroll(prev.bankroll, -prev.bet),
      result: { result: "loss" as const, amount: -prev.bet },
    };
  }
  if (val === 21) return flipHoleAndEnterDealerTurn(prev);
  return prev; // No change.
}

/** Hook that manages a single blackjack hand plus its continuing shoe. */
export function useBlackjack() {
  // state.deck IS the shoe's live remainder -- it's never wiped between
  // hands (resetGame only clears playerHand/dealerHand/bet/phase), so
  // there's one source of truth for "what's left to deal" and nothing
  // separate to keep in sync with it.
  // Initial state must match SSR (no localStorage access) to avoid a
  // hydration mismatch; the mount effect below swaps in stored values.
  const [state, setState] = useState<BlackjackState | null>(() => ({
    playerHand: [], dealerHand: [], deck: createShoe(DEFAULT_DECK_COUNT),
    phase: "betting" as GamePhase, bet: 0, bankroll: DEFAULT_BANKROLL,
  }));

  // Identifies the "live" hand. Reveal timers compare against this before
  // touching state, so a reset/new-hand mid-reveal can't resurrect a stale
  // hand's cards or payout even if the effect cleanup below were somehow
  // skipped.
  const handIdRef = useRef(0);

  // --- Deck count + card-counting state ---
  const [deckCount, setDeckCountState] = useState<number>(DEFAULT_DECK_COUNT);
  const [justReshuffled, setJustReshuffled] = useState(false);
  const [runningCountValue, setRunningCountValue] = useState(0);
  const [lastCountedCard, setLastCountedCard] = useState<{ card: Card; delta: number } | undefined>();
  const [countVisible, setCountVisibleState] = useState<boolean>(false);
  const countedIds = useRef<Set<string>>(new Set());

  // Adopt persisted values once mounted -- the initial render above uses
  // SSR-safe defaults so hydration matches, this pulls in the real values.
  useEffect(() => {
    const storedDeckCount = getDeckCount();
    const storedBankroll = getBankroll();
    const storedCountVisible = getCountVisible();
    if (storedDeckCount === DEFAULT_DECK_COUNT && storedBankroll === DEFAULT_BANKROLL && !storedCountVisible) {
      return; // nothing persisted diverges from the defaults already on screen
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate one-time hydration adoption of browser-only values, not a data-fetch loop
    setDeckCountState(storedDeckCount);
    setCountVisibleState(storedCountVisible);
    setState(prev => (prev ? { ...prev, bankroll: storedBankroll, deck: createShoe(storedDeckCount) } : prev));
  }, []);

  // Persist bankroll after every resolved outcome.
  useEffect(() => {
    if (state?.phase === "result") saveBankroll(state.bankroll);
  }, [state?.phase, state?.bankroll]);

  // Card counting is decoupled from every draw/reveal call site: whenever a
  // previously-unseen card becomes face-up anywhere in the current hand, tag
  // it once by id. This stays correct regardless of the paced dealer reveal.
  useEffect(() => {
    if (!state) return;
    const visible = [...state.playerHand, ...state.dealerHand].filter(c => c.faceUp);
    const fresh = visible.filter(c => !countedIds.current.has(c.id));
    if (fresh.length === 0) return;
    for (const c of fresh) countedIds.current.add(c.id);
    setRunningCountValue(rc => rc + sumHiLo(fresh));
    const last = fresh[fresh.length - 1];
    setLastCountedCard({ card: last, delta: hiLoValue(last.rank) });
  }, [state]);

  // Draws the dealer's finished hand card by card, then applies the payout.
  // Fires once per hand entering dealerTurn (keyed on the phase value, not
  // the whole state, so the reveal's own ticks don't re-trigger it). Cleanup
  // clears any un-fired timers on unmount or when phase moves on for any
  // reason (new hand, reset) — that's what makes it cancel-safe.
  useEffect(() => {
    if (!state || state.phase !== "dealerTurn") return;

    const myHandId = handIdRef.current;
    const outcome = computeResult(state.playerHand, state.deck, state.dealerHand, state.bet);
    const extraCards = outcome.dealerHand.slice(state.dealerHand.length);
    const timers: ReturnType<typeof setTimeout>[] = [];

    extraCards.forEach((card, i) => {
      timers.push(setTimeout(() => {
        if (handIdRef.current !== myHandId) return;
        setState(s => (s ? { ...s, dealerHand: [...s.dealerHand, card] } : s));
      }, REVEAL_DELAY_MS * (i + 1)));
    });

    // Guaranteed to reach "result" even if a step is somehow skipped, since
    // every tick is its own fixed-delay timer rather than a chain where one
    // dropped callback could strand the next.
    timers.push(setTimeout(() => {
      if (handIdRef.current !== myHandId) return;
      setState(s => {
        if (!s) return s;
        return {
          ...s,
          playerHand: outcome.playerHand,
          dealerHand: outcome.dealerHand,
          deck: outcome.deck,
          phase: "result" as GamePhase,
          bankroll: updateBankroll(s.bankroll, outcome.amount),
          result: { result: outcome.resultType, amount: outcome.amount },
        };
      });
    }, REVEAL_DELAY_MS * (extraCards.length + 1)));

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on phase alone: the reveal's own ticks change dealerHand but must not re-trigger this effect
  }, [state?.phase]);

  // --- Actions ---

  const setDeckCount = useCallback((n: number) => {
    saveDeckCount(n);
    setDeckCountState(n);
    setRunningCountValue(0);
    setLastCountedCard(undefined);
    countedIds.current.clear();
    setState(prev => (prev ? { ...prev, deck: createShoe(n) } : prev));
  }, []);

  const toggleCountVisible = useCallback(() => {
    setCountVisibleState(v => {
      const next = !v;
      saveCountVisible(next);
      return next;
    });
  }, []);

  /** User confirms a bet. Reshuffles at the penetration threshold, then deals; checks for instant blackjack. */
  const placeBet = useCallback((amount: number) => {
    if (!state || state.phase !== "betting") return;
    const bet = Math.min(Math.max(1, Math.floor(amount)), state.bankroll);
    if (bet <= 0) return;

    // Reshuffle only ever considered here, at a hand boundary -- never mid-hand.
    const reshuffling = needsReshuffle(state.deck.length, deckCount);
    const startingDeck = reshuffling ? createShoe(deckCount) : state.deck;
    if (reshuffling) {
      setRunningCountValue(0);
      setLastCountedCard(undefined);
      countedIds.current.clear();
    }
    setJustReshuffled(reshuffling);

    setState(prev => {
      if (!prev || prev.phase !== "betting") return prev;

      const pc1     = engineDraw(startingDeck, () => createShoe(deckCount));    // player card  1
      const dc1Up   = engineDraw(pc1.remaining, () => createShoe(deckCount));   // dealer upcard
      const pc2     = engineDraw(dc1Up.remaining, () => createShoe(deckCount)); // player card  2
      const dc2Down = engineDraw(pc2.remaining, () => createShoe(deckCount));   // dealer hole

      return {
        ...prev,
        deck: dc2Down.remaining,
        playerHand: [pc1.card, pc2.card].map(c => ({ ...c, faceUp: true })),
        dealerHand: [{ ...dc1Up.card, faceUp: true }, { ...dc2Down.card, faceUp: false }],
        bet,
        phase: "playerTurn" as GamePhase,
      };
    });

    // Peek at hole card: check for instant blackjack or just flip it.
    // Deferring to separate render from the deal allows React to paint the initial cards before revealing the hole card, avoiding a jarring transition when dealer has blackjack.
    setTimeout(() => setState(peekResolve), 0);
  }, [state, deckCount]);

  /** Draw one more card for the player. Bust/21 resolves automatically. */
  const hit = useCallback(() => {
    setState(prev => {
      if (!prev || prev.phase !== "playerTurn") return prev;
      // The penetration floor keeps every hand's starting shoe well above what
      // a hand can consume, so this fallback should be unreachable -- if it
      // fires, that's a bug in the threshold, not something to hide.
      const drawn = engineDraw(prev.deck, () => {
        console.error("blackjack: shoe exhausted mid-hand -- penetration threshold gave insufficient headroom");
        return createShoe(deckCount);
      });
      const newHand = [...prev.playerHand, drawn.card];
      return { ...prev, playerHand: newHand, deck: drawn.remaining };
    });

    // Check for bust / auto-stand after card lands.
    setTimeout(() => setState(checkBust), 0);
  }, [deckCount]);

  /** Stop drawing — dealer plays out hand, revealed one card at a time. */
  const stand = useCallback(() => {
    setState(prev => {
      if (!prev || prev.phase !== "playerTurn") return prev;
      return flipHoleAndEnterDealerTurn(prev);
    });
  }, []);

  /** Reset to betting screen (keep bankroll and the continuing shoe). Cancels any in-flight reveal. */
  const resetGame = useCallback(() => {
    handIdRef.current += 1;
    setState(prev => ({
      playerHand: [], dealerHand: [], deck: prev?.deck ?? createShoe(getDeckCount()),
      phase: "betting" as GamePhase, bet: 0, bankroll: prev?.bankroll ?? getBankroll(),
    }));
  }, []);

  /** Reset bankroll to starting stack (500) and show betting screen (shoe keeps going). */
  const resetBankroll = useCallback(() => {
    handIdRef.current += 1;
    try { localStorage.setItem(STORAGE_KEY, "500"); } catch { /* noop */ }
    setState(prev => ({
      playerHand: [], dealerHand: [], deck: prev?.deck ?? createShoe(getDeckCount()),
      phase: "betting" as GamePhase, bet: 0, bankroll: 500,
    }));
  }, []);

  const decksLeft = computeDecksRemaining(state?.deck.length ?? 0);
  const trueCountValue = computeTrueCount(runningCountValue, decksLeft);

  return {
    state, placeBet, hit, stand, resetGame, resetBankroll,
    deckCount, setDeckCount, justReshuffled,
    runningCount: runningCountValue, trueCount: trueCountValue, decksRemaining: decksLeft, lastCountedCard,
    countVisible, toggleCountVisible,
  };
}
