"use client"

interface Props {
  onHit: () => void;
  onStand: () => void;
  onDouble?: () => void;
  onSplit?: () => void;
  onSurrender?: () => void;
  canDouble?: boolean;
  canSurrender?: boolean;
  splitOffered?: boolean;
  canSplit?: boolean;
  splitReason?: string | null;
}

export default function ActionButtons({
  onHit, onStand, onDouble, onSplit, onSurrender,
  canDouble = false, canSurrender = false, splitOffered = false, canSplit = false, splitReason = null,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3 mt-4 justify-center">
      <button type="button" onClick={onHit}
        className="bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
        Hit
      </button>
      <button type="button" onClick={onStand}
        className="bg-zinc-600 hover:bg-zinc-500 disabled:opacity-30 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
        Stand
      </button>
      {onDouble && (
        <button type="button" onClick={onDouble} disabled={!canDouble}
          title={canDouble ? "Double your bet, take exactly one more card" : "Double down isn't available on this hand"}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
          Double
        </button>
      )}
      {onSplit && splitOffered && (
        <button type="button" onClick={onSplit} disabled={!canSplit}
          title={canSplit ? "Split this pair into two hands" : (splitReason ?? "Split isn't available")}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
          Split
        </button>
      )}
      {onSurrender && (
        <button type="button" onClick={onSurrender} disabled={!canSurrender}
          title={canSurrender ? "Forfeit half your bet and end this hand now" : "Surrender isn't available on this hand"}
          className="bg-red-900 hover:bg-red-800 disabled:opacity-30 text-red-200 font-bold py-3 px-8 rounded-lg text-lg transition-colors">
          Surrender
        </button>
      )}
    </div>
  );
}
