"use client"
import Card from "./card"
import CardGhost from "./card-ghost"
import { calculateHandValue } from "../lib/engine"
import type { Card as GameCard } from "../lib/types"

interface Props {
  cards: readonly GameCard[]
}

export default function DealerHand({ cards }: Props) {
  const revealed = cards.filter(c => c.faceUp)
  const hasHiddenCard = cards.some(c => !c.faceUp)
  // Only sum the up-card while the hole card is hidden -- never leak its value.
  const total = revealed.length > 0 ? calculateHandValue(revealed) : 0
  const isBust = !hasHiddenCard && total > 21

  return (
    <div data-testid="dealer-zone" className="flex flex-col items-center gap-2 sm:gap-1.5">
      <h3 className="text-sm font-semibold tracking-wide text-white/90 uppercase">Dealer</h3>
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 min-h-[5rem] sm:min-h-[7rem] items-center">
        {cards.length > 0
          ? cards.map(c => <Card key={c.id} card={c} />)
          : <><CardGhost /><CardGhost /></>}
      </div>
      <span className={`text-xl font-bold h-7 ${isBust ? "text-red-400" : "text-zinc-100"}`}>
        {cards.length === 0 ? " " : hasHiddenCard ? `${total} + ?` : total}
      </span>
    </div>
  )
}
