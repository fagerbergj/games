"use client"

interface Props {
  onHit: () => void;
  onStand: () => void;
}

export default function ActionButtons({ onHit, onStand }: Props) {
  return (
    <div className="flex gap-4 mt-4">
      <button
        type="button"
        onClick={onHit}
        className="bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white font-bold py-3 px-12 rounded-lg text-xl transition-colors"
      >
        Hit
      </button>
      <button
        type="button"
        onClick={onStand}
        className="bg-zinc-600 hover:bg-zinc-500 disabled:opacity-30 text-white font-bold py-3 px-12 rounded-lg text-xl transition-colors"
      >
        Stand
      </button>
    </div>
  );
}
