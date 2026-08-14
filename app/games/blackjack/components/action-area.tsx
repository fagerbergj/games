"use client"
import BettingControls from "./betting-controls"
import ActionButtons from "./action-buttons"
import StrategyHint from "./strategy-hint"
import InsuranceHint from "./insurance-hint"
import CountTrigger from "./count-trigger"
import { isBlackjack } from "../lib/engine"
import { MIN_CHIP_DENOMINATION } from "../lib/chips"
import { STARTING_BANKROLL } from "../lib/bankroll"
import { formatMoney } from "../lib/money"
import type { Card, HouseRules, Seat, TablePhase } from "../lib/types"

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
  houseRules: HouseRules;
  trueCount: number;
  onPlaceBet: (amount: number) => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onSurrender: () => void;
  onTakeInsurance: (amount: number) => void;
  onDeclineInsurance: () => void;
  onTakeEvenMoney: () => void;
  onBuyBackIn: () => void;
  /** Only passed for the seat that should render the table-wide New Round control. */
  onResetRound?: () => void;
  runningCount: number;
  decksRemaining: number;
  lastCountedCard?: { card: Card; delta: number };
  countVisible: boolean;
  onToggleCountVisible: () => void;
  justReshuffled: boolean;
  countOpen: boolean;
  onToggleCount: () => void;
  onCloseCount: () => void;
}

/** The one place a seat's controls live — swaps by phase so the felt underneath never moves. */
export default function ActionArea({
  seat, phase, isActiveSeat, actions, dealerUpCard, houseRules, trueCount,
  onPlaceBet, onHit, onStand, onDouble, onSplit, onSurrender,
  onTakeInsurance, onDeclineInsurance, onTakeEvenMoney, onBuyBackIn, onResetRound,
  runningCount, decksRemaining, lastCountedCard, countVisible, onToggleCountVisible, justReshuffled,
  countOpen, onToggleCount, onCloseCount,
}: Props) {
  // The count matters where a player is about to act on it: sizing a bet, or playing a hand.
  const showCount = phase === "betting" || (phase === "playerTurns" && isActiveSeat);
  const countTrigger = showCount ? (
    <CountTrigger
      open={countOpen}
      onToggle={onToggleCount}
      onClose={onCloseCount}
      runningCount={runningCount}
      trueCountValue={trueCount}
      decksLeft={decksRemaining}
      lastCountedCard={lastCountedCard}
      visible={countVisible}
      onToggleVisible={onToggleCountVisible}
      justReshuffled={justReshuffled}
    />
  ) : null;

  if (phase === "betting") {
    if (seat.bankroll < MIN_CHIP_DENOMINATION) {
      return (
        <div className="flex flex-col items-center gap-2">
          <p className="text-zinc-400 text-sm">You&rsquo;re out of chips</p>
          <div className="flex items-center gap-4">
            <button type="button" onClick={onBuyBackIn}
              className="min-h-11 flex items-center bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-sm px-4 py-2 rounded-lg">
              Buy back in ({formatMoney(STARTING_BANKROLL)})
            </button>
            {countTrigger}
          </div>
        </div>
      );
    }
    return (
      <BettingControls
        bankroll={seat.bankroll} pendingBet={seat.pendingBet} lastWager={seat.lastWager} onBet={onPlaceBet}
        countTrigger={countTrigger}
      />
    );
  }

  if (phase === "insurance") {
    const hand = seat.hands[0];
    const eligibleForEvenMoney = hand && isBlackjack(hand.cards);
    if (seat.insurance !== null) {
      return (
        <p className="text-zinc-500 text-xs">
          {seat.insurance.bet > 0 ? `Insured for ${formatMoney(seat.insurance.bet)}` : "Declined insurance"} — waiting on the table
        </p>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3">
        {/* Same gap/height treatment as the main action row (#21) -- opposite-consequence
            money buttons offered under time pressure need the same touch-target floor. */}
        <div className="flex gap-4 flex-wrap justify-center">
          <button type="button" onClick={() => onTakeInsurance((hand?.bet ?? 0) / 2)}
            title="Side bet, up to half your wager, pays 2:1 if the dealer has blackjack"
            className="min-h-11 flex items-center bg-blue-700 hover:bg-blue-600 text-white font-bold text-sm px-4 py-2 rounded-lg">
            Insurance ({formatMoney((hand?.bet ?? 0) / 2)})
          </button>
          {eligibleForEvenMoney && (
            <button type="button" onClick={onTakeEvenMoney}
              title="Lock in a guaranteed 1:1 payout on your blackjack instead of risking the dealer also having one"
              className="min-h-11 flex items-center bg-green-700 hover:bg-green-600 text-white font-bold text-sm px-4 py-2 rounded-lg">
              Even money
            </button>
          )}
          <button type="button" onClick={onDeclineInsurance}
            className="min-h-11 flex items-center bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-sm px-4 py-2 rounded-lg">
            No insurance
          </button>
        </div>
        <InsuranceHint trueCount={trueCount} />
      </div>
    );
  }

  if (phase === "playerTurns" && isActiveSeat && actions) {
    const activeHand = seat.hands[seat.activeHandIndex];
    return (
      <div className="flex flex-col items-center gap-2">
        <ActionButtons
          onHit={onHit} onStand={onStand} onDouble={onDouble} onSplit={onSplit} onSurrender={onSurrender}
          canDouble={actions.canDouble} canSurrender={actions.canSurrender}
          splitOffered={actions.splitOffered} canSplit={actions.canSplit} splitReason={actions.splitReason}
          countTrigger={countTrigger}
        />
        {activeHand && dealerUpCard && (
          <StrategyHint
            playerHand={activeHand.cards}
            dealerUpCard={dealerUpCard}
            rules={houseRules}
            isSplitHand={activeHand.isSplitHand}
          />
        )}
      </div>
    );
  }

  if (phase === "dealerTurn") {
    return isActiveSeat ? <p className="text-zinc-400 text-sm animate-pulse">Dealer is drawing&hellip;</p> : null;
  }

  if (phase === "result") {
    const insuranceNote = seat.insurance && seat.insurance.bet > 0
      ? <p className="text-xs text-zinc-500">Insurance {seat.insurance.result === "win" ? "won" : "lost"}</p>
      : null;
    // Lands where Hit/Stand just were, so ending one hand and starting the next barely moves the cursor.
    if (!insuranceNote && !onResetRound) return null;
    return (
      <div className="flex flex-col items-center gap-2">
        {insuranceNote}
        {onResetRound && (
          <button type="button" onClick={onResetRound}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-8 rounded-lg text-lg">
            New Round
          </button>
        )}
      </div>
    );
  }

  return null;
}
