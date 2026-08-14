"use client"
import BettingControls from "./betting-controls"
import ActionButtons from "./action-buttons"
import StrategyHint from "./strategy-hint"
import ChipStack from "./chip-stack"
import ResultBanner from "./result-banner"
import { isBlackjack } from "../lib/engine"
import type { Card, Seat, TablePhase } from "../lib/types"

interface Actions {
  canHit: boolean
  canStand: boolean
  canDouble: boolean
  canSurrender: boolean
  splitOffered: boolean
  canSplit: boolean
  splitReason: string | null
}

interface Props {
  seat: Seat;
  phase: TablePhase;
  isActiveSeat: boolean;
  actions: Actions | null;
  dealerUpCard?: Card;
  onPlaceBet: (amount: number) => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onSurrender: () => void;
  onTakeInsurance: (amount: number) => void;
  onDeclineInsurance: () => void;
  onTakeEvenMoney: () => void;
}

const SETTLE_VARIANT: Record<string, "win" | "loss" | "push"> = {
  win: "win", blackjack: "win", "even-money": "win", loss: "loss", surrender: "loss", push: "push",
};

/** The one place a seat's controls live — swaps by phase so the felt underneath never moves. */
export default function ActionArea({
  seat, phase, isActiveSeat, actions, dealerUpCard,
  onPlaceBet, onHit, onStand, onDouble, onSplit, onSurrender,
  onTakeInsurance, onDeclineInsurance, onTakeEvenMoney,
}: Props) {
  if (phase === "betting") {
    if (seat.pendingBet > 0) {
      return (
        <div className="flex flex-col items-center gap-2">
          <ChipStack amount={seat.pendingBet} />
          <p className="text-zinc-500 text-xs">Bet placed — waiting on the table</p>
        </div>
      );
    }
    return <BettingControls bankroll={seat.bankroll} onBet={onPlaceBet} confirmLabel="Place Bet" />;
  }

  if (phase === "insurance") {
    const hand = seat.hands[0];
    const eligibleForEvenMoney = hand && isBlackjack(hand.cards);
    if (seat.insurance !== null) {
      return (
        <p className="text-zinc-500 text-xs">
          {seat.insurance.bet > 0 ? `Insured for $${seat.insurance.bet}` : "Declined insurance"} — waiting on the table
        </p>
      );
    }
    return (
      <div className="flex gap-2 flex-wrap justify-center">
        <button type="button" onClick={() => onTakeInsurance((hand?.bet ?? 0) / 2)}
          title="Side bet, up to half your wager, pays 2:1 if the dealer has blackjack"
          className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-3 py-2 rounded-lg">
          Insurance (${(hand?.bet ?? 0) / 2})
        </button>
        {eligibleForEvenMoney && (
          <button type="button" onClick={onTakeEvenMoney}
            title="Lock in a guaranteed 1:1 payout on your blackjack instead of risking the dealer also having one"
            className="bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-2 rounded-lg">
            Even money
          </button>
        )}
        <button type="button" onClick={onDeclineInsurance}
          className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm px-3 py-2 rounded-lg">
          No insurance
        </button>
      </div>
    );
  }

  if (phase === "playerTurns" && isActiveSeat && actions) {
    const activeHand = seat.hands[seat.activeHandIndex];
    return (
      <div className="flex flex-col items-center gap-3">
        <ChipStack amount={seat.hands.reduce((sum, h) => sum + h.bet, 0)} />
        <ActionButtons
          onHit={onHit} onStand={onStand} onDouble={onDouble} onSplit={onSplit} onSurrender={onSurrender}
          canDouble={actions.canDouble} canSurrender={actions.canSurrender}
          splitOffered={actions.splitOffered} canSplit={actions.canSplit} splitReason={actions.splitReason}
        />
        {activeHand && dealerUpCard && <StrategyHint playerHand={activeHand.cards} dealerUpCard={dealerUpCard} />}
      </div>
    );
  }

  if (phase === "dealerTurn") {
    return (
      <div className="flex flex-col items-center gap-3">
        <ChipStack amount={seat.hands.reduce((sum, h) => sum + h.bet, 0)} />
        {isActiveSeat && <p className="text-zinc-400 text-sm animate-pulse">Dealer is drawing&hellip;</p>}
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="flex flex-col items-center gap-2">
        {seat.hands.map(h => h.result && (
          <div key={h.id} className="flex flex-col items-center gap-1">
            <ChipStack amount={h.bet} variant={SETTLE_VARIANT[h.result.result] ?? "neutral"} />
            <ResultBanner result={h.result} />
          </div>
        ))}
        {seat.insurance && seat.insurance.bet > 0 && (
          <p className="text-xs text-zinc-500">Insurance {seat.insurance.result === "win" ? "won" : "lost"}</p>
        )}
      </div>
    );
  }

  return null;
}
