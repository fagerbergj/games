"use client"
import { calculateHandValue } from "../lib/engine"
import Card from "./card"
import CardGhost from "./card-ghost"
import type { Card as GameCard } from "../lib/types"

interface Props {
  cards: readonly GameCard[]
}

export default function PlayerHand({ cards }: Props) {
  const total = cards.length > 0 ? calculateHandValue([...cards]) : 0
  const isBust = total > 21

  return (
    <div data-testid="player-zone" className="flex flex-col items-center gap-2">
      <h3 className="text-sm font-semibold tracking-wide text-white/90 uppercase">Your Hand</h3>
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 min-h-[5rem] sm:min-h-[7rem] items-center">
        {cards.length > 0
          ? cards.map(c => <Card key={c.id} card={c} />)
          : <><CardGhost /><CardGhost /></>}
      </div>
      <span className={`text-xl font-bold h-7 ${isBust ? "text-red-400" : "text-zinc-100"}`}>
        {cards.length > 0 ? total : " "}
      </span>
    </div>
  )
}
