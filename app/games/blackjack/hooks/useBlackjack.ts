import { useState, useCallback, useEffect } from "react";
import {
  shuffledDeck, drawCard as engineDraw, isBlackjack, calculateHandValue,
  dealerDraw as engineDealerDraw, updateBankroll,
} from "../lib/engine";
import { saveBankroll } from "../lib/bankroll";
import type { Card, BlackjackState, GamePhase } from "../lib/types";

const STORAGE_KEY = "blackjack_bankroll";

function loadBankroll(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const v = parseInt(raw ?? "", 10);
    return Number.isFinite(v) ? Math.max(0, v) : 500;
  } catch {
    return 500;
  }
}

interface Outcome {
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  resultType: "win" | "loss" | "push" | "blackjack";
  amount: number;
}

function computeResult(
  playerCards: readonly Card[],
  deck: readonly Card[],
  dealerCards: readonly Card[],
  bet: number,
): Outcome {
  const pv    = calculateHandValue([...playerCards]);
  const pj    = isBlackjack([...playerCards]);
  const drawn = engineDealerDraw([...deck], [...dealerCards]);
  const dv    = calculateHandValue(drawn.hand);
  const dj    = isBlackjack(drawn.hand);

  if (pj && !dj) return { playerHand: Array.from(playerCards), dealerHand: drawn.hand, deck: [...drawn.deck], resultType: "blackjack", amount: Math.round(bet * 1.5) };
  if (pv > 21) return { playerHand: Array.from(playerCards), dealerHand: drawn.hand, deck: [...drawn.deck], resultType: "loss", amount: -bet };
  if (dj && !pj) return { playerHand: Array.from(playerCards), dealerHand: drawn.hand, deck: [...drawn.deck], resultType: "loss", amount: -bet };
  if (pv > dv) return { playerHand: Array.from(playerCards), dealerHand: drawn.hand, deck: [...drawn.deck], resultType: "win", amount: bet };
  return { playerHand: Array.from(playerCards), dealerHand: drawn.hand, deck: [...drawn.deck], resultType: "push", amount: 0 };
}

function resolveTurn(prev: BlackjackState | null): BlackjackState | null {
  if (!prev) return null;
  const flipped: Card[] = [prev.dealerHand[0], { ...prev.dealerHand[1], faceUp: true }];
  const outcome         = computeResult(prev.playerHand, prev.deck, flipped, prev.bet);

  return {
    ...prev,
    playerHand: outcome.playerHand,
    dealerHand: outcome.dealerHand.map(c => ({ ...c, faceUp: true })),
    deck: outcome.deck,
    phase: "result" as GamePhase,
    bankroll: updateBankroll(prev.bankroll, outcome.amount),
    result: { result: outcome.resultType, amount: outcome.amount },
  };
}

// Called after placeBet to peek at hole card and check for instant blackjack.
function peekResolve(prev: BlackjackState | null): BlackjackState | null {
  if (!prev) return prev;

  const flipped: Card[] = [prev.dealerHand[0], { ...prev.dealerHand[1], faceUp: true }];
  const pj    = isBlackjack(prev.playerHand);
  const dj    = isBlackjack(flipped);

  if (pj && dj) {
    return { ...prev, dealerHand: flipped.map(c => ({ ...c, faceUp: true })), phase: "result" as GamePhase, result: { result: "push", amount: 0 } };
  }

  // Player has blackjack — dealer plays out.
  if (pj && !dj) {
    return resolveTurn(prev);
  }

  // Neither BJ — just flip hole card for display. Normal player turn.
  return { ...prev, dealerHand: [flipped[0], { ...flipped[1], faceUp: true }] };
}

// Called after hit() to check if the new hand busts.
function checkBust(
  prev: BlackjackState | null,
): BlackjackState | null {
  if (!prev || prev.phase !== "playerTurn") return prev;
  const val = calculateHandValue(prev.playerHand);
  if (val > 21) {
    // Bust — dealer flips but doesn't necessarily play out.
    const flipped: Card[] = [prev.dealerHand[0], { ...prev.dealerHand[1], faceUp: true }];
    return { ...prev, dealerHand: flipped.map(c => ({ ...c, faceUp: true })), phase: "result" as GamePhase, bankroll: updateBankroll(prev.bankroll, -prev.bet), result: { result: "loss" as const, amount: -prev.bet } };
  }
  if (val === 21) {
    return resolveTurn(prev);
  }
  return prev; // No change.
}

/** Hook that manages a single blackjack hand. */
export function useBlackjack() {
  const [state, setState] = useState<BlackjackState | null>(() => ({
    playerHand: [], dealerHand: [], deck: [],
    phase: "betting" as GamePhase, bet: 0, bankroll: loadBankroll(),
  }));

  // Persist bankroll after every resolved outcome.
  useEffect(() => {
    if (state?.phase === "result") saveBankroll(state.bankroll);
  }, [state]);

  const peek = useCallback((prev: BlackjackState | null): BlackjackState | null => peekResolve(prev), []);
  const chkBust = useCallback((prev: BlackjackState | null): BlackjackState | null => checkBust(prev), []);

  // --- Actions ---

  /** User confirms a bet. Deals cards and checks for instant blackjack. */
  const placeBet = useCallback((amount: number) => {
    setState(prev => {
      if (!prev || prev.phase !== "betting") return null;
      const bet = Math.min(Math.max(1, Math.floor(amount)), prev.bankroll);
      if (bet <= 0) return prev;

      // Deal four cards from shuffled deck.
      const deck     = shuffledDeck();
      const pc1      = engineDraw(deck);              // player card  1
      const dc1Up   = engineDraw(pc1.remaining);       // dealer upcard
      const pc2      = engineDraw(dc1Up.remaining);    // player card  2
      const dc2Down = engineDraw(pc2.remaining);        // dealer hole

      return {
        ...prev,
        deck: dc2Down.remaining,
        playerHand: [pc1.card, pc2.card].map(c => ({ ...c, faceUp: true })),
        dealerHand: [{ ...dc1Up.card, faceUp: true }, { ...dc2Down.card, faceUp: false }],
        bet,
      };
    });

    // Peek at hole card: check for instant blackjack or just flip it.
    setTimeout(() => setState(peek), 0);
  }, [peek]);

  /** Draw one more card for the player. Bust/21 resolves automatically. */
  const hit = useCallback(() => {
    setState(prev => {
      if (!prev || prev.phase !== "playerTurn") return prev;
      const drawn   = engineDraw(prev.deck);
      const newHand = [...prev.playerHand, drawn.card];
      return { ...prev, playerHand: newHand, deck: drawn.remaining };
    });

    // Check for bust / auto-stand after card lands.
    setTimeout(() => setState(chkBust), 0);
  }, [chkBust]);

  /** Stop drawing — dealer plays out hand, payout calculated. */
  const stand = useCallback(() => {
    setState(resolveTurn);
  }, []);

  /** Reset to betting screen (keep bankroll). */
  const resetGame = useCallback(() => setState(null), []);

  /** Reset bankroll to starting stack (500) and show betting screen. */
  const resetBankroll = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, "500"); } catch { /* noop */ }
    setState({
      playerHand: [], dealerHand: [], deck: [],
      phase: "betting" as GamePhase, bet: 0, bankroll: 500,
    });
  }, []);

  return { state, placeBet, hit, stand, resetGame, resetBankroll };
}
