"use client"

import type { Card, HouseRules, Seat, TablePhase } from "../lib/types"
import PlayerHand from "./player-hand"
import ActionArea from "./action-area"
import BankrollTray from "./bankroll-tray"
import ChipStack from "./chip-stack"
import ResultBanner from "./result-banner"

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
  seat: Seat
  phase: TablePhase
  isActiveSeat: boolean
  actions: Actions | null
  dealerUpCard?: Card
  dealerHasBlackjack: boolean
  houseRules: HouseRules
  trueCount: number
  onPlaceBet: (amount: number) => void
  onHit: () => void
  onStand: () => void
  onDouble: () => void
  onSplit: () => void
  onSurrender: () => void
  onTakeInsurance: (amount: number) => void
  onDeclineInsurance: () => void
  onTakeEvenMoney: () => void
  onResetBankroll: () => void
  onBuyBackIn: () => void
}

const SETTLE_VARIANT: Record<string, "win" | "loss" | "push"> = {
  win: "win", blackjack: "win", "even-money": "win", loss: "loss", surrender: "loss", push: "push",
};

export default function SeatPanel({
  seat, phase, isActiveSeat, actions, dealerUpCard, dealerHasBlackjack, houseRules, trueCount,
  onPlaceBet, onHit, onStand, onDouble, onSplit, onSurrender,
  onTakeInsurance, onDeclineInsurance, onTakeEvenMoney, onResetBankroll, onBuyBackIn,
}: Props) {
  return (
    <div className={`bg-white/5 border rounded-2xl p-3 sm:p-4 flex flex-col items-center gap-3 ${isActiveSeat ? "border-yellow-500" : "border-white/10"}`}>
      <div className="flex items-center justify-between w-full gap-2">
        <span className="text-zinc-200 text-sm font-semibold uppercase tracking-wide">{seat.label}</span>
        <BankrollTray bankroll={seat.bankroll} />
      </div>

      {seat.hands.length > 0 ? (
        <div className="flex flex-wrap gap-3 justify-center">
          {seat.hands.map((h, i) => (
            <div key={h.id} className="flex flex-col items-center gap-2">
              <PlayerHand
                cards={h.cards}
                title={seat.hands.length > 1 ? `Hand ${i + 1}` : undefined}
                active={isActiveSeat && seat.activeHandIndex === i && phase === "playerTurns"}
              />
              {/* Wager stays visible from deal through settlement, attributed to this hand's own column. */}
              <ChipStack amount={h.bet} variant={h.result ? (SETTLE_VARIANT[h.result.result] ?? "neutral") : "neutral"} />
              {h.result && <ResultBanner result={h.result} dealerHasBlackjack={dealerHasBlackjack} />}
            </div>
          ))}
        </div>
      ) : (
        seat.pendingBet > 0 && <ChipStack amount={seat.pendingBet} />
      )}

      <ActionArea
        seat={seat}
        phase={phase}
        isActiveSeat={isActiveSeat}
        actions={actions}
        dealerUpCard={dealerUpCard}
        houseRules={houseRules}
        trueCount={trueCount}
        onPlaceBet={onPlaceBet}
        onHit={onHit} onStand={onStand} onDouble={onDouble} onSplit={onSplit} onSurrender={onSurrender}
        onTakeInsurance={onTakeInsurance} onDeclineInsurance={onDeclineInsurance} onTakeEvenMoney={onTakeEvenMoney}
        onBuyBackIn={onBuyBackIn}
      />

      {phase === "result" && seat.bankroll <= 0 && (
        <button type="button" onClick={onResetBankroll}
          className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold py-2 px-4 rounded-lg">
          Reset Bankroll
        </button>
      )}
    </div>
  )
}
