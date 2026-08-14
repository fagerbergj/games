"use client"
import type { BlackjackResult } from "../lib/types"

interface Props {
  result: BlackjackResult;
  bankroll?: number;
  onDealAgain?: () => void;
}

const COPY: Record<BlackjackResult["result"], { label: string; color: string }> = {
  blackjack:   { label: "Blackjack!",   color: "text-yellow-400" },
  win:         { label: "You Win",      color: "text-green-400" },
  loss:        { label: "Dealer Wins",  color: "text-red-400" },
  push:        { label: "Push",         color: "text-zinc-300" },
  surrender:   { label: "Surrendered",  color: "text-zinc-400" },
  "even-money": { label: "Even Money",  color: "text-green-400" },
};

/** Slim inline result strip — never covers the felt or the final hands. */
export default function ResultBanner({ result, bankroll, onDealAgain }: Props) {
  const { label, color } = COPY[result.result];
  const delta = result.amount > 0 ? `+$${result.amount}` : result.amount < 0 ? `-$${Math.abs(result.amount)}` : "Bet returned";

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 bg-zinc-900/90 border border-zinc-700 rounded-xl px-6 py-3 shadow-lg">
      <span className={`text-xl font-bold ${color}`}>{label}</span>
      <span className="text-zinc-300 font-semibold">{delta}</span>
      {bankroll !== undefined && <span className="text-zinc-500 text-sm">Bankroll: ${bankroll}</span>}
      {onDealAgain && (
        <button
          type="button"
          onClick={onDealAgain}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-6 rounded-lg text-sm transition-colors"
        >
          Deal Again
        </button>
      )}
    </div>
  );
}
