"use client"
import { getBookAdvice } from "../lib/strategy"
import type { Card, HouseRules } from "../lib/types"

interface Props {
  playerHand: readonly Card[]
  dealerUpCard: Card
  rules: HouseRules
  isSplitHand?: boolean
}

// Always visible rather than hover-only: this is a learning tool, and the
// point is to see the reasoning before acting, not to have to go looking for it.
export default function StrategyHint({ playerHand, dealerUpCard, rules, isSplitHand = false }: Props) {
  if (playerHand.length === 0) return null
  const advice = getBookAdvice(playerHand, dealerUpCard, rules, isSplitHand)

  return (
    <div className="max-w-xl text-center text-xs bg-black/30 border border-white/10 rounded-lg px-3 py-1.5">
      <span className="font-semibold text-yellow-400 uppercase tracking-wide">
        Book says: {advice.book}
        {advice.ruleBlocked && ` (not available at this table — ${advice.recommended} instead)`}
      </span>
      <p className="mt-0.5 text-zinc-300 normal-case">{advice.reason}</p>
    </div>
  )
}
