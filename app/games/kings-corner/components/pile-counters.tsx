import { useState } from "react";
import type { Card, GameState } from "../lib/types";
import { getCardCounts } from "../lib/positions";

type Pile = "deck" | "discard";

function PileTable({ cards }: { cards: Card[] }) {
  const rows = getCardCounts(cards);
  if (rows.length === 0) return <div className="px-4 py-3 text-zinc-500 text-sm">Empty</div>;
  return (
    <table className="text-sm w-full">
      <thead>
        <tr className="text-zinc-500 text-xs uppercase tracking-wider">
          <th className="px-4 py-2 text-left font-medium">Rank</th>
          <th className="px-4 py-2 text-right font-medium">Count</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ rank, symbol, count }) => (
          <tr key={rank} className="border-t border-zinc-800">
            <td className="px-4 py-1.5 text-white">{symbol}</td>
            <td className="px-4 py-1.5 text-right font-bold text-white">{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PileButton({ label, count, open, onClick }: { label: string; count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-zinc-400 text-sm px-3 py-1 rounded-full transition-colors ${open ? "bg-zinc-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
    >
      {label}: <span className="font-bold text-white">{count}</span>
    </button>
  );
}

export default function PileCounters({ gameState }: { gameState: GameState }) {
  const [expanded, setExpanded] = useState<Pile | null>(null);
  const toggle = (pile: Pile) => setExpanded(expanded === pile ? null : pile);

  return (
    <div className="flex items-center justify-center gap-3 mb-2 relative">
      {expanded && <div className="fixed inset-0 z-10" onClick={() => setExpanded(null)} />}
      <PileButton label="Deck" count={gameState.deck.length} open={expanded === "deck"} onClick={() => toggle("deck")} />
      <PileButton label="Discard" count={gameState.discardPile.length} open={expanded === "discard"} onClick={() => toggle("discard")} />
      {gameState.cheatCount > 0 && (
        <span className="bg-red-900/60 text-red-300 text-sm px-3 py-1 rounded-full">
          Cheats: <span className="font-bold">{gameState.cheatCount}</span>
        </span>
      )}
      {expanded && (
        <div className="absolute top-full mt-2 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
          <div className="px-4 py-2 bg-zinc-800 border-b border-zinc-700 text-left">
            <span className="text-white font-bold text-sm">{expanded === "deck" ? "Deck" : "Discard Pile"}</span>
          </div>
          <PileTable cards={expanded === "deck" ? gameState.deck : gameState.discardPile} />
        </div>
      )}
    </div>
  );
}
