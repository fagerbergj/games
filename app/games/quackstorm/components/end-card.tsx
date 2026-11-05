"use client";

interface EndCardProps {
  won: boolean;
  stars: number;
  isLastLevel: boolean;
  onReplay: () => void;
  onNext: () => void;
}

/** Short end card: stars (by clear time against the level's starTimes) and replay / next-level buttons. */
export default function EndCard({ won, stars, isLastLevel, onReplay, onNext }: EndCardProps) {
  return (
    <div className="absolute inset-0 rounded-xl bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-3xl font-black" style={{ color: won ? "#fbbf24" : "#f87171" }}>
        {won ? "Keep Destroyed!" : "The Geese Got You"}
      </h2>
      {won && (
        <div className="text-3xl tracking-widest" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ color: i < stars ? "#fbbf24" : "#3f3f46" }}>
              ★
            </span>
          ))}
        </div>
      )}
      <p className="text-zinc-300 text-sm">
        {won ? "Faster clears earn more stars." : "A goose reached the cannon."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={onReplay}
          className="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold px-5 py-2 rounded-lg"
        >
          Replay
        </button>
        {won && !isLastLevel && (
          <button
            onClick={onNext}
            className="bg-green-600 hover:bg-green-500 text-white font-semibold px-5 py-2 rounded-lg"
          >
            Next Level
          </button>
        )}
      </div>
    </div>
  );
}
