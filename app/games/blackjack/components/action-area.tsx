"use client"
import BettingControls from "./betting-controls"
import ActionButtons from "./action-buttons"
import ChipStack from "./chip-stack"
import ResultBanner from "./result-banner"
import type { BlackjackState } from "../lib/types"

interface Props {
  state: BlackjackState;
  onBet: (amount: number) => void;
  onHit: () => void;
  onStand: () => void;
  onDealAgain: () => void;
}

const SETTLE_VARIANT: Record<string, "win" | "loss" | "push"> = {
  win: "win", blackjack: "win", loss: "loss", push: "push",
};

/** The one place controls live -- swaps by phase so the felt underneath never moves. */
export default function ActionArea({ state, onBet, onHit, onStand, onDealAgain }: Props) {
  if (state.phase === "betting") {
    return <BettingControls bankroll={state.bankroll} onBet={onBet} />;
  }

  if (state.phase === "playerTurn") {
    return (
      <div className="flex flex-col items-center gap-3">
        <ChipStack amount={state.bet} />
        <ActionButtons onHit={onHit} onStand={onStand} />
      </div>
    );
  }

  if (state.phase === "dealerTurn") {
    return (
      <div className="flex flex-col items-center gap-3">
        <ChipStack amount={state.bet} />
        <p className="text-zinc-400 text-sm animate-pulse">Dealer is drawing&hellip;</p>
      </div>
    );
  }

  if (state.phase === "result" && state.result) {
    return (
      <div className="flex flex-col items-center gap-3">
        <ChipStack amount={state.bet} variant={SETTLE_VARIANT[state.result.result]} />
        <ResultBanner result={state.result} bankroll={state.bankroll} onDealAgain={onDealAgain} />
      </div>
    );
  }

  return null;
}
