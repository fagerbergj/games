"use client";

import { useQuackstorm } from "./hooks/useQuackstorm";
import { Choice, EndCard, River } from "./components";

export default function QuackstormPage() {
  const game = useQuackstorm(1);
  const isLastLevel = game.level >= game.levelCount;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-amber-400">🦆 Quackstorm</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">Level {game.level} / {game.levelCount}</span>
            <button
              onClick={game.replay}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Restart
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-4 flex flex-col items-center">
        <div className="relative w-full max-w-[440px]">
          <River {...game} />
          {game.phase === "choice" && (
            <Choice narrator={game.narrator} choice={game.choice} onPick={game.choose} />
          )}
          {(game.phase === "won" || game.phase === "lost") && (
            <EndCard
              won={game.phase === "won"}
              stars={game.stars}
              isLastLevel={isLastLevel}
              onReplay={game.replay}
              onNext={game.next}
            />
          )}
        </div>

        <div className="mt-4 w-full max-w-[440px] bg-zinc-900 rounded-xl p-4 text-sm text-zinc-300">
          <h3 className="font-bold mb-2 text-white">How to play</h3>
          <ul className="space-y-1 text-zinc-400">
            <li>Drag left/right to aim, hold to fire a duckling upstream.</li>
            <li>Lily-pad gates multiply or shrink the flock: <span className="text-green-400">×3</span> makes three, <span className="text-red-400">−10</span> removes ten.</li>
            <li>Eggs show <span className="text-violet-400">?</span> until first crossed.</li>
            <li>Pop geese one for one; reach the Goose Keep to score hits.</li>
            <li>Fill the bread meter to fire the Big Mama (🦆) for a big splash.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
