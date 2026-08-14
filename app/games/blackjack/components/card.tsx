"use client"
import type { Card } from "../lib/types"

export default function Card({ card, className = "" }: { card: Card; className?: string }) {
  const suitSymbols: Record<string, string> = {
    hearts: "\u2665",
    diamonds: "\u2666",
    clubs: "\u2663",
    spades: "\u2660",
  }

  const rankSymbols: Record<number, string> = {
    1: "A", 11: "J", 12: "Q", 13: "K",
  }

  const rank   = rankSymbols[card.rank] ?? card.rank.toString()
  const suit   = suitSymbols[card.suit] ?? card.suit
  const isRed  = card.suit === "hearts" || card.suit === "diamonds"

  if (!card.faceUp) {
    // Patterned back (not a plain box) so a hidden card still reads as a card, not a gap.
    return (
      <div
        data-testid="card-back"
        className={`w-14 h-20 sm:w-20 sm:h-28 rounded-lg shadow-md border-2 border-red-950 shrink-0 ${className ?? ""}`}
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #b91c1c 0px, #b91c1c 4px, #7f1d1d 4px, #7f1d1d 8px)" }}
      >
        <div className="w-full h-full rounded-md border border-red-950/50 m-0.5" style={{ width: "calc(100% - 0.25rem)", height: "calc(100% - 0.25rem)" }} />
      </div>
    )
  }

  return (
    <div data-testid="card" className={
      `relative w-14 h-20 sm:w-20 sm:h-28 bg-white border border-zinc-200 rounded-lg shadow-md cursor-default select-none shrink-0 ${className ?? ""}`
    }>
      <div className="absolute top-1 left-1 flex flex-col items-center">
        <span className={`text-[10px] sm:text-xs font-bold leading-none ${isRed ? "text-red-600" : "text-zinc-900"}`}>{rank}</span>
        <span className={`text-[10px] sm:text-xs leading-none ${isRed ? "text-red-600" : "text-zinc-900"}`}>{suit}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg sm:text-2xl ${isRed ? "text-red-600" : "text-zinc-900"}`}>{suit}</span>
      </div>
      <div className="absolute bottom-1 right-1 flex flex-col items-center rotate-180">
        <span className={`text-[10px] sm:text-xs font-bold leading-none ${isRed ? "text-red-600" : "text-zinc-900"}`}>{rank}</span>
        <span className={`text-[10px] sm:text-xs leading-none ${isRed ? "text-red-600" : "text-zinc-900"}`}>{suit}</span>
      </div>
    </div>
  )
}
