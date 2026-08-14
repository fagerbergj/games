"use client"
import { getInsuranceAdvice } from "../lib/strategy"

interface Props {
  trueCount: number
}

// Same illustrative style as StrategyHint: the biggest beginner mistake at the table
// gets the same "book says, and here's why" treatment as every other decision point.
export default function InsuranceHint({ trueCount }: Props) {
  const advice = getInsuranceAdvice(trueCount)

  return (
    <div className="max-w-md text-center text-xs bg-black/30 border border-white/10 rounded-lg px-3 py-2">
      <span className="font-semibold text-yellow-400 uppercase tracking-wide">
        Book says: {advice.take ? "Take it" : "No insurance"}
      </span>
      <p className="mt-1 text-zinc-300 normal-case">{advice.reason}</p>
    </div>
  )
}
