"use client";

import { useFlappyBird } from "./hooks/useFlappyBird";
import { FlappyBirdBoard } from "./components/FlappyBirdBoard";
import { CANVAS_WIDTH } from "./lib/game";

export default function GamePage() {
  const { state, onJump, onReset } = useFlappyBird();

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-yellow-400">Flappy Bird</h1>
          <button
            onClick={onReset}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            New Game
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4">
        <div className="flex flex-col items-center gap-6">
          {/* Score bar */}
          <div className="flex items-center gap-8 text-sm text-zinc-300">
            <span>Score: <strong className="text-white">{state.score}</strong></span>
            <span>Best: <strong className="text-yellow-400">{state.highScore}</strong></span>
          </div>

          {/* Game board */}
          <div style={{ width: CANVAS_WIDTH }}>
            <FlappyBirdBoard state={state} onJump={onJump} />
          </div>

          {/* Instructions */}
          <div className="bg-zinc-800 rounded-xl p-4 text-sm text-zinc-300 max-w-md w-full">
            <h3 className="font-bold mb-2 text-white">How to Play:</h3>
            <ul className="space-y-1 text-xs text-zinc-400">
              <li>• Click or tap the board to make the bird fly</li>
              <li>• Navigate through the gaps in the pipes</li>
              <li>• Each pipe passed = 1 point</li>
              <li>• Don&apos;t hit pipes, the ground, or the ceiling!</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
