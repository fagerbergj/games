/** Casino chip denominations, largest first, sized against a $500 starting bankroll. */
export const CHIP_DENOMINATIONS = [500, 100, 25, 5] as const;
export type ChipDenomination = (typeof CHIP_DENOMINATIONS)[number];

/** Standard US casino ladder shifted to our four denominations. */
export const CHIP_COLORS: Record<ChipDenomination, { fill: string; ring: string; text: string }> = {
  5:   { fill: "bg-white",     ring: "ring-zinc-400",  text: "text-zinc-900" },
  25:  { fill: "bg-red-600",   ring: "ring-red-300",   text: "text-white" },
  100: { fill: "bg-green-700", ring: "ring-green-300", text: "text-white" },
  500: { fill: "bg-zinc-900",  ring: "ring-yellow-400", text: "text-yellow-400" },
};

/**
 * Break an amount into the fewest chips (largest denomination first). Only
 * exact for amounts actually built from CHIP_DENOMINATIONS — a stray amount
 * gets whatever chips fit, dropping any un-representable remainder.
 */
export function decomposeToChips(amount: number): ChipDenomination[] {
  const chips: ChipDenomination[] = [];
  let remaining = Math.max(0, Math.floor(amount));
  for (const denom of CHIP_DENOMINATIONS) {
    while (remaining >= denom) {
      chips.push(denom);
      remaining -= denom;
    }
  }
  return chips;
}
