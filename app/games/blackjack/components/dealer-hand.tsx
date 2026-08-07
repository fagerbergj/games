"use client"
import Card from "./card"
import { calculateHandValue } from "../lib/engine"
import type { Card as GameCard } from "../lib/types"

interface Props {
  cards: readonly GameCard[]
}

export default function DealerHand({ cards }: Props) {
  const revealed = cards.filter(c => c.faceUp)
  const total = revealed.length > 0 ? calculateHandValue(revealed) : 0
  const isBust = total > 21

  return (
    <div className="flex flex-col items-center gap-3">
      <h3 className="text-lg font-semibold text-white">Dealer</h3>
      <div className="flex -space-x-8">
        {cards.map(c => (
          <Card key={c.id} card={c} />
        ))}
      </div>
      {revealed.length > 0 && (
        <span className={`text-2xl font-bold ${isBust ? "text-red-400" : "text-zinc-100"}`}>
          {total}
        </span>
      )}
    </div>
  )
}
