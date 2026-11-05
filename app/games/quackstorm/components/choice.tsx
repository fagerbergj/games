"use client";

interface ChoiceProps {
  narrator: string;
  choice: { label: string }[];
  onPick: (index: 0 | 1) => void;
}

/** The over-the-top fake-ad opener: two giant gates, one smug narrator. */
export default function Choice({ narrator, choice, onPick }: ChoiceProps) {
  return (
    <div className="absolute inset-0 rounded-xl bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-amber-300 font-semibold italic text-lg leading-snug">“{narrator}”</p>
      <div className="flex gap-4 w-full max-w-xs">
        {choice.map((g, i) => (
          <button
            key={i}
            onClick={() => onPick(i as 0 | 1)}
            className="flex-1 aspect-square rounded-2xl text-4xl font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: i === 0 ? "#16a34a" : "#7c3aed" }}
          >
            {g.label}
          </button>
        ))}
      </div>
      <p className="text-zinc-300 text-sm">Drag to aim · hold to fire bread</p>
    </div>
  );
}
