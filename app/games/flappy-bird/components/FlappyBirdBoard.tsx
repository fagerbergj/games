"use client";

import { CANVAS_HEIGHT, GROUND_HEIGHT } from "../lib/game";
import { Bird } from "./Bird";
import { Pipe } from "./Pipe";

interface FlappyBirdBoardProps {
  state: import("../lib/types").FlappyBirdState;
  onJump: () => void;
}

export function FlappyBirdBoard({ state, onJump }: FlappyBirdBoardProps) {
  // Calculate bird rotation based on velocity
  const rotation = Math.min(Math.max(state.bird.velocity * 3, -30), 90);

  return (
    <div
      className="relative overflow-hidden rounded-xl cursor-pointer select-none"
      style={{
        width: CANVAS_HEIGHT,
        height: CANVAS_HEIGHT,
        background: "linear-gradient(180deg, #87CEEB 0%, #98fb98 85%, #f5f5dc 100%)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
      onClick={onJump}
    >
      {/* Clouds */}
      <div className="absolute z-5 top-[5%] left-[10%] w-20 h-8 bg-white/70 rounded-full" />
      <div className="absolute z-5 top-[15%] right-[15%] w-16 h-6 bg-white/50 rounded-full" />
      <div className="absolute z-5 top-[8%] left-[50%] w-24 h-7 bg-white/60 rounded-full" />

      {/* Pipes */}
      {state.pipes.map((pipe) => (
        <Pipe key={pipe.id} x={pipe.x} gapY={pipe.gapY} />
      ))}

      {/* Bird */}
      <Bird y={state.bird.y} rotation={rotation} />

      {/* Ground */}
      <div
        className="absolute z-20 left-0 right-0"
        style={{ bottom: 0, height: GROUND_HEIGHT }}
      >
        <div className="w-full h-3 bg-green-700" />
        <div className="w-full h-[calc(100%-12px)] bg-amber-700" />
      </div>

      {/* Score display */}
      {state.phase !== "ready" && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
          <span
            className="text-5xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            style={{ WebkitTextStroke: "2px #000" }}
          >
            {state.score}
          </span>
        </div>
      )}

      {/* Ready state */}
      {state.phase === "ready" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/20">
          <h2 className="text-4xl font-bold text-white drop-shadow-lg mb-4" style={{ textShadow: "2px 2px 8px rgba(0,0,0,0.8)" }}>
            Flappy Bird
          </h2>
          <p className="text-xl text-white/90 animate-pulse">Click or tap to start</p>
        </div>
      )}

      {/* Game Over */}
      {state.phase === "gameover" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white/95 dark:bg-zinc-800/95 rounded-2xl p-8 shadow-2xl text-center max-w-xs w-full mx-4">
            <h2 className="text-3xl font-bold text-red-600 mb-2">Game Over!</h2>
            <div className="space-y-2 mb-6">
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">Score: {state.score}</p>
              <p className="text-sm text-zinc-500">Best: {state.highScore}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onJump(); }}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-lg transition-colors shadow-md"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
