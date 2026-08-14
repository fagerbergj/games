"use client"
import { rankLabel, countMeaning } from "../lib/count"
import type { Card } from "../lib/types"

interface Props {
  runningCount: number
  trueCountValue: number
  decksLeft: number
  lastCountedCard?: { card: Card; delta: number }
  visible: boolean
  onToggle: () => void
  justReshuffled: boolean
}

export default function CountPanel({
  runningCount, trueCountValue, decksLeft, lastCountedCard, visible, onToggle, justReshuffled,
}: Props) {
  return (
    <div className="text-xs bg-black/30 border border-white/10 rounded-lg px-3 py-2 w-full max-w-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="text-zinc-400 font-semibold">Card count (Hi-Lo)</span>
        <button type="button" onClick={onToggle} className="text-zinc-400 hover:text-zinc-200 underline">
          {visible ? "Hide" : "Reveal"}
        </button>
      </div>

      {justReshuffled && <p className="mt-1 text-yellow-400">Shoe reshuffled — count reset.</p>}

      {visible ? (
        <div className="mt-1 space-y-0.5 text-zinc-300">
          {lastCountedCard && (
            <p>
              Last card: {rankLabel(lastCountedCard.card.rank)} ={" "}
              {lastCountedCard.delta > 0 ? "+1" : lastCountedCard.delta === 0 ? "0" : "-1"}
            </p>
          )}
          <p>Running count: {runningCount}</p>
          <p>Decks remaining: {decksLeft.toFixed(1)}</p>
          <p>
            True count: {runningCount} ÷ {decksLeft.toFixed(1)} ≈ {trueCountValue}
          </p>
          <p className="text-zinc-400 italic">{countMeaning(trueCountValue)}</p>
        </div>
      ) : (
        <p className="mt-1 text-zinc-500 italic">Hidden — count it yourself, then reveal to check.</p>
      )}
    </div>
  )
}
