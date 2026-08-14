"use client"
import Chip from "./chip"
import { decomposeToChips } from "../lib/chips"

interface Props {
  amount: number;
  /** Visual settle state once a hand resolves. */
  variant?: "neutral" | "win" | "loss" | "push";
  emptyLabel?: string;
}

const VARIANT_CLASSES: Record<NonNullable<Props["variant"]>, string> = {
  neutral: "",
  win: "animate-pulse ring-2 ring-green-400 rounded-full",
  loss: "opacity-40 grayscale",
  push: "ring-2 ring-zinc-400 rounded-full",
};

/** Fanned stack of chips standing in for a wager, e.g. in the betting circle. */
export default function ChipStack({ amount, variant = "neutral", emptyLabel }: Props) {
  const chips = decomposeToChips(amount);

  if (chips.length === 0) {
    return (
      <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/30 text-xs text-center px-2">
        {emptyLabel ?? "Bet"}
      </div>
    );
  }

  return (
    <div className={`relative flex items-end ${VARIANT_CLASSES[variant]}`} style={{ height: "4rem" }}>
      {chips.slice(0, 6).map((denom, i) => (
        <div key={i} className="relative" style={{ marginLeft: i === 0 ? 0 : "-2.75rem", zIndex: i }}>
          <Chip denomination={denom} size="sm" />
        </div>
      ))}
      {chips.length > 6 && (
        <span className="ml-2 text-xs text-zinc-300 self-center">+{chips.length - 6}</span>
      )}
    </div>
  );
}
