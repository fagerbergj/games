"use client"
import { useState, useCallback, useMemo } from "react"
import Chip from "./chip"
import ChipStack from "./chip-stack"
import { CHIP_DENOMINATIONS } from "../lib/chips"

interface Props {
  bankroll: number;
  onBet: (amount: number) => void;
}

/** Chip tray + betting circle. Mounts fresh each hand, so wager state resets for free. */
export default function BettingControls({ bankroll, onBet }: Props) {
  const [chips, setChips] = useState<number[]>([]);
  const wager = useMemo(() => chips.reduce((sum, c) => sum + c, 0), [chips]);

  const addChip = useCallback((denom: number) => {
    setChips(prev => (wager + denom > bankroll ? prev : [...prev, denom]));
  }, [bankroll, wager]);

  const clear = useCallback(() => setChips([]), []);

  const deal = useCallback(() => {
    if (wager > 0 && wager <= bankroll) onBet(wager);
  }, [wager, bankroll, onBet]);

  const canDeal = wager > 0 && wager <= bankroll;

  return (
    <div className="flex flex-col items-center gap-3">
      <div aria-live="polite" className="sr-only">Current wager ${wager}</div>
      <ChipStack amount={wager} emptyLabel="Place bet" />

      <div className="flex gap-2 flex-wrap justify-center">
        {CHIP_DENOMINATIONS.map(denom => (
          <Chip
            key={denom}
            denomination={denom}
            onClick={() => addChip(denom)}
            disabled={wager + denom > bankroll}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={chips.length === 0}
          className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-200 px-5 py-2 rounded-lg text-sm font-semibold"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={deal}
          disabled={!canDeal}
          className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold px-8 py-2 rounded-lg text-sm"
        >
          Deal
        </button>
      </div>
    </div>
  );
}
