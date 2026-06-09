"use client";

import { Player } from "../lib/types";

export default function StatsComponent({
  players,
  currentTurn,
}: {
  players: Player[];
  currentTurn: number;
}) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-zinc-900 rounded-2xl p-6 shadow-xl">
      <h3 className="text-xl font-bold text-white mb-4">Player Statistics</h3>

      <div className="space-y-3">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`
              flex items-center justify-between p-3 rounded-lg transition-all
              ${index === 0 ? "bg-yellow-500/20 border border-yellow-500/50" : ""}
              ${player.id === players[currentTurn]?.id ? "ring-2 ring-blue-500" : ""}
            `}
          >
            <div className="flex items-center gap-3">
              <span className={`
                w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold
                ${index === 0 ? "bg-yellow-500 text-white" : "bg-zinc-700 text-zinc-300"}
              `}>
                {index + 1}
              </span>
              <span className={`font-medium ${player.id === players[currentTurn]?.id ? "text-blue-400" : "text-white"}`}>
                {player.name}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-zinc-400 text-sm">{player.hand.length} cards</span>
              <span className="text-white font-bold">{player.score} pts</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Active Player</span>
          <span className="text-blue-400 font-medium">
            {players[currentTurn]?.name}
          </span>
        </div>
      </div>
    </div>
  );
}
