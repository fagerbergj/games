import type { GameState } from "../lib/types";

const BACKDROP = "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm";
const CARD = "bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-10 text-center max-w-sm w-full mx-4";
const PRIMARY = "bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-lg text-lg transition-colors";

function cheatedTimes(n: number): string {
  return `Cheated ${n} time${n === 1 ? "" : "s"}`;
}

function gameOverTitle(gameState: GameState): string {
  if (gameState.cheatCount > 0) return "Cheater and Still Lost!";
  return gameState.deck.length === 0 ? "Out of Cards!" : "No Moves Available!";
}

export function GameOverDialog({ gameState, onReset, onCheat }: { gameState: GameState; onReset: () => void; onCheat: () => void }) {
  return (
    <div className={BACKDROP}>
      <div className={CARD}>
        <h2 className="text-3xl font-bold text-white mb-3">{gameOverTitle(gameState)}</h2>
        <p className="text-zinc-400 mb-8">
          {gameState.cheatCount > 0
            ? `${cheatedTimes(gameState.cheatCount)} and still couldn't win.`
            : "Better luck next time!"}
        </p>
        <div className="flex flex-col gap-3">
          <button onClick={onReset} className={PRIMARY}>New Game</button>
          <button
            onClick={onCheat}
            className="bg-red-900 hover:bg-red-800 text-red-300 font-bold py-3 px-8 rounded-lg text-lg transition-colors"
          >
            Cheat
          </button>
        </div>
      </div>
    </div>
  );
}

export function WonDialog({ cheatCount, onReset }: { cheatCount: number; onReset: () => void }) {
  return (
    <div className={BACKDROP}>
      <div className={CARD}>
        <h2 className="text-3xl font-bold text-yellow-400 mb-3">
          {cheatCount > 0 ? "You Won... by Cheating 🤨" : "You Won!"}
        </h2>
        <p className="text-zinc-400 mb-8">
          {cheatCount > 0 ? `${cheatedTimes(cheatCount)}. Does it even count?` : "Every edge filled with royalty!"}
        </p>
        <button onClick={onReset} className={`${PRIMARY} w-full`}>Play Again</button>
      </div>
    </div>
  );
}
