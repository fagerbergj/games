"use client"
import { getBookAdvice } from "../lib/strategy"
import type { Card } from "../lib/types"

interface Props {
  playerHand: readonly Card[]
  dealerUpCard: Card
}

// Always visible rather than hover-only: this is a learning tool, and the
// point is to see the reasoning before acting, not to have to go looking for it.
export default function StrategyHint({ playerHand, dealerUpCard }: Props) {
  if (playerHand.length === 0) return null
  const advice = getBookAdvice(playerHand, dealerUpCard)

  return (
    <div className="max-w-md text-center text-xs bg-black/30 border border-white/10 rounded-lg px-3 py-2">
      <span className="font-semibold text-yellow-400 uppercase tracking-wide">
        Book says: {advice.book}
        {advice.noteUnavailable && ` (not offered in this game yet — ${advice.recommended} instead)`}
      </span>
      <p className="mt-1 text-zinc-300 normal-case">{advice.reason}</p>
    </div>
  )
}
