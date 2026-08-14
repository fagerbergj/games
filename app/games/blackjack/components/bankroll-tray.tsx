"use client"
import Chip from "./chip"
import { decomposeToChips } from "../lib/chips"

interface Props {
  bankroll: number;
}

/** Reads as a chip tray (groove + a couple of resting chips) rather than a bare number. */
export default function BankrollTray({ bankroll }: Props) {
  const topChips = decomposeToChips(bankroll).slice(0, 2);

  return (
    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-full pl-2 pr-4 py-1 shadow-inner">
      <div className="flex -space-x-2">
        {topChips.length > 0
          ? topChips.map((d, i) => <Chip key={i} denomination={d} size="sm" />)
          : <Chip denomination={5} size="sm" />}
      </div>
      <span data-testid="bankroll-amount" className="text-yellow-400 font-bold text-lg">${bankroll}</span>
    </div>
  );
}
