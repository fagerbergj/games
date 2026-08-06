"use client"
import { calculateHandValue } from "../lib/engine"
import Card from "./card"
import type { Card as GameCard } from "../lib/types"

interface Props {
  cards: readonly GameCard[]
}

export default function PlayerHand({ cards }: Props) {
  const total = cards.length > 0 ? calculateHandValue([...cards]) : 0
  const isBust = total > 21

  return (
    <div className="flex flex-col items-center gap-3">
      <h3 className="text-lg font-semibold text-white">Your Hand</h3>
      <div className="flex -space-x-8">
        {cards.map(c => (
          <Card key={c.id} card={c} />
        ))}
      </div>
      {cards.length > 0 && (
        <span className={`text-2xl font-bold ${isBust ? "text-red-400" : "text-zinc-100"}`}>
          {total}
        </span>
      )}
    </div>
  )
}
