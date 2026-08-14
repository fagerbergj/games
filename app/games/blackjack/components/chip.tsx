"use client"
import { CHIP_COLORS, type ChipDenomination } from "../lib/chips"

interface Props {
  denomination: ChipDenomination;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

/** A single clickable casino chip, or (with no onClick) a static chip for stack display. */
export default function Chip({ denomination, onClick, disabled = false, size = "md" }: Props) {
  const { fill, ring, text } = CHIP_COLORS[denomination];
  const dim = size === "sm" ? "w-10 h-10 text-[10px]" : "w-16 h-16 text-sm";

  const chip = (
    <div
      className={`${dim} ${fill} ${text} rounded-full ring-2 ${ring} ring-offset-2 ring-offset-transparent border-2 border-dashed border-current/30 flex items-center justify-center font-bold shadow-md select-none`}
    >
      ${denomination}
    </div>
  );

  if (!onClick) return chip;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Add $${denomination} chip`}
      className="disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed hover:-translate-y-1 transition-transform"
    >
      {chip}
    </button>
  );
}
