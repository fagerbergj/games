"use client"
import { calculateHandValue } from "../lib/engine"
import Card from "./card"
import CardGhost from "./card-ghost"
import type { Card as GameCard } from "../lib/types"

interface Props {
  cards: readonly GameCard[]
  /** Omit when the seat has only one hand — the seat panel's own label already names it. */
  title?: string
  active?: boolean
  statusLabel?: string
}

/** Renders one hand's cards, running total, and (once settled) status — reused for every seat's hand(s). */
export default function PlayerHand({ cards, title, active = false, statusLabel }: Props) {
  const total = cards.length > 0 ? calculateHandValue([...cards]) : 0
  const isBust = total > 21

  return (
    <div
      data-testid="player-zone"
      className={`flex flex-col items-center gap-2 rounded-lg p-2 ${active ? "ring-2 ring-yellow-500" : ""}`}
    >
      {title && <h3 className="text-sm font-semibold tracking-wide text-white/90 uppercase">{title}</h3>}
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 min-h-[5rem] sm:min-h-[7rem] items-center">
        {cards.length > 0
          ? cards.map(c => <Card key={c.id} card={c} />)
          : <><CardGhost /><CardGhost /></>}
      </div>
      <span className={`text-xl font-bold h-7 ${isBust ? "text-red-400" : "text-zinc-100"}`}>
        {cards.length > 0 ? total : " "}
      </span>
      {statusLabel && <span className="text-xs text-zinc-400">{statusLabel}</span>}
    </div>
  )
}
