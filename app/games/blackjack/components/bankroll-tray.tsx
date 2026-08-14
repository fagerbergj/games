"use client"
import Chip from "./chip"
import { CHIP_DENOMINATIONS, type ChipDenomination } from "../lib/chips"
import { formatMoney } from "../lib/money"

interface Props {
  bankroll: number;
}

// One representative chip, not a decomposed stack -- a partial stack (e.g. two $100s
// beside "$451") reads as a chip count, and any count that isn't the true total is a lie.
function topDenomination(bankroll: number): ChipDenomination {
  return CHIP_DENOMINATIONS.find(d => bankroll >= d) ?? CHIP_DENOMINATIONS[CHIP_DENOMINATIONS.length - 1];
}

/** Reads as a chip tray (groove + one resting chip) rather than a bare number. */
export default function BankrollTray({ bankroll }: Props) {
  return (
    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-full pl-2 pr-4 py-1 shadow-inner">
      <Chip denomination={topDenomination(bankroll)} size="sm" />
      <span data-testid="bankroll-amount" className="text-yellow-400 font-bold text-lg">{formatMoney(bankroll)}</span>
    </div>
  );
}
