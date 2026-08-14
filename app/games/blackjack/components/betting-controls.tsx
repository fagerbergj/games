"use client"
import { useState } from "react"
import Chip from "./chip"
import ChipStack from "./chip-stack"
import { CHIP_DENOMINATIONS } from "../lib/chips"
import { formatMoney } from "../lib/money"

interface Props {
  bankroll: number;
  /** seat.pendingBet — 0 until this seat commits. */
  pendingBet: number;
  /** seat.lastWager — prefilled as an uncommitted suggestion when it still fits the bankroll. */
  lastWager: number;
  onBet: (amount: number) => void;
  /** Count trigger, rendered beside the chip row rather than floating on its own. */
  countTrigger?: React.ReactNode;
}

/**
 * Chip tray + betting circle. There is no separate confirm button: the circle itself
 * (prefilled from last hand's wager, or built up chip by chip) is what commits — tap it.
 * Mounts fresh each hand, so the uncommitted wager resets for free.
 */
export default function BettingControls({ bankroll, pendingBet, lastWager, onBet, countTrigger }: Props) {
  const staged = lastWager > 0 && lastWager <= bankroll ? lastWager : 0;
  const [wager, setWager] = useState(staged);

  if (pendingBet > 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <ChipStack amount={pendingBet} />
        <div className="flex items-center gap-2">
          <p className="text-zinc-500 text-xs">Bet placed — waiting on the table</p>
          {countTrigger}
        </div>
      </div>
    );
  }

  const addChip = (denom: number) => {
    if (wager + denom > bankroll) return;
    setWager(w => w + denom);
  };
  const clear = () => setWager(0);
  const commit = () => {
    if (wager > 0) onBet(wager);
  };
  // Same string drives the aria-label and the visible caption, so the label-in-name stays trivially true.
  const commitLabel = wager > 0 ? `Place bet of ${formatMoney(wager)}` : "Add a chip to place a bet";

  return (
    <div className="flex flex-col items-center gap-3">
      <div aria-live="polite" className="sr-only">Current wager {formatMoney(wager)}</div>

      {/* The only commit control -- one click stages -> deals. Visible caption (not just
          aria-label) is what makes that obvious to a sighted first-time player. */}
      <button
        type="button"
        onClick={commit}
        disabled={wager === 0}
        aria-label={commitLabel}
        className="flex flex-col items-center gap-1.5 rounded-3xl border-2 border-dashed border-yellow-500/70 bg-yellow-500/10 hover:bg-yellow-500/20 hover:border-yellow-400 disabled:border-white/20 disabled:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-5 py-3"
      >
        <ChipStack amount={wager} />
        <span className={`text-sm font-bold ${wager > 0 ? "text-yellow-400" : "text-zinc-500"}`}>
          {commitLabel}
        </span>
      </button>

      <div className="flex gap-5 flex-wrap justify-center items-center">
        {CHIP_DENOMINATIONS.map(denom => (
          <Chip
            key={denom}
            denomination={denom}
            onClick={() => addChip(denom)}
            disabled={wager + denom > bankroll}
          />
        ))}
        {countTrigger && (
          <div className="flex items-center pl-4 sm:border-l sm:border-white/15">
            {countTrigger}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={clear}
        disabled={wager === 0}
        className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-200 px-5 py-2 rounded-lg text-sm font-semibold"
      >
        Clear
      </button>
    </div>
  );
}
