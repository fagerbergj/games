"use client"

import type { Card, Seat, TablePhase } from "../lib/types"
import PlayerHand from "./player-hand"
import ActionArea from "./action-area"
import BankrollTray from "./bankroll-tray"

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
}

export default function SeatPanel({
  seat, phase, isActiveSeat, actions, dealerUpCard,
  onPlaceBet, onHit, onStand, onDouble, onSplit, onSurrender,
  onTakeInsurance, onDeclineInsurance, onTakeEvenMoney, onResetBankroll,
}: Props) {
  return (
    <div className={`bg-white/5 border rounded-2xl p-3 sm:p-4 flex flex-col items-center gap-3 ${isActiveSeat ? "border-yellow-500" : "border-white/10"}`}>
      <div className="flex items-center justify-between w-full gap-2">
        <span className="text-zinc-200 text-sm font-semibold uppercase tracking-wide">{seat.label}</span>
        <BankrollTray bankroll={seat.bankroll} />
      </div>

      {seat.hands.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center">
          {seat.hands.map((h, i) => (
            <PlayerHand
              key={h.id}
              cards={h.cards}
              title={seat.hands.length > 1 ? `Hand ${i + 1}` : seat.label}
              active={isActiveSeat && seat.activeHandIndex === i && phase === "playerTurns"}
            />
          ))}
        </div>
      )}

      <ActionArea
        seat={seat}
        phase={phase}
        isActiveSeat={isActiveSeat}
        actions={actions}
        dealerUpCard={dealerUpCard}
        onPlaceBet={onPlaceBet}
        onHit={onHit} onStand={onStand} onDouble={onDouble} onSplit={onSplit} onSurrender={onSurrender}
        onTakeInsurance={onTakeInsurance} onDeclineInsurance={onDeclineInsurance} onTakeEvenMoney={onTakeEvenMoney}
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
