"use client";

import { useEffect, useCallback } from "react";
import { useFlappyBird } from "./hooks/useFlappyBird";
import { GameCanvas } from "./components";

export default function GamePage() {
  const {
    state,
    initializeGame,
    startPlaying,
    flapBird,
    resetGame,
    canvasWidth,
    canvasHeight,
  } = useFlappyBird();

  // Initialize game on mount
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Handle flap — start playing on first tap
  const handleFlap = useCallback(() => {
    if (!state) return;

    if (state.phase === "gameover") {
      resetGame();
      initializeGame();
      startPlaying();
    } else if (state.phase === "setup") {
      startPlaying();
    }
    flapBird();
  }, [state, resetGame, initializeGame, startPlaying, flapBird]);

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleFlap();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, handleFlap]);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-green-400">Flappy Bird</h1>
          <button
            onClick={() => { resetGame(); initializeGame(); }}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            New Game
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6">
          {state && (
            <>
              {/* High score display */}
              {state.highScore > 0 && (
                <p className="text-zinc-500 text-sm">
                  Best: <span className="text-yellow-400 font-bold">{state.highScore}</span>
                </p>
              )}

              {/* Game Canvas */}
              <GameCanvas
                state={state}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                onFlap={handleFlap}
              />

              {/* Instructions */}
              <div className="bg-zinc-800 rounded-xl p-4 text-sm text-zinc-300 max-w-md text-center">
                <p>Click or press <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs text-white">Space</kbd> to flap.</p>
                <p className="mt-1 text-zinc-500">Navigate through the gaps in the pipes without hitting them or the ground.</p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
