"use client"
import { DECK_COUNT_OPTIONS } from "../lib/shoe"

interface Props {
  deckCount: number;
  onChange: (n: number) => void;
}

/** Shoe size picker -- only meaningful at the betting screen; changing it shuffles a fresh shoe. */
export default function DeckSelector({ deckCount, onChange }: Props) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1.5">
        {DECK_COUNT_OPTIONS.map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={deckCount === n}
            className={`text-xs px-2.5 py-1 rounded-md border ${
              deckCount === n
                ? "bg-yellow-500 border-yellow-500 text-black font-bold"
                : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300"
            }`}
          >
            {n} deck{n > 1 ? "s" : ""}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">Changing this shuffles a fresh shoe</p>
    </div>
  )
}
