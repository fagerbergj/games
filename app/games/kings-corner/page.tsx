"use client";

import { useState, useEffect } from "react";
import { useKingsCorner } from "./hooks/useKingsCorner";
import { useDiscardSelection } from "./hooks/useDiscardSelection";
import CardComponent from "./components/card";
import Board from "./components/board";
import PileCounters from "./components/pile-counters";
import CardPlacementHint from "./components/placement-hint";
import { GameOverDialog, WonDialog } from "./components/end-dialogs";

export default function GamePage() {
  const { gameState, setGameState, initializeGame, playCard, resumePlaying, cheat } = useKingsCorner();
  const discard = useDiscardSelection(gameState, setGameState);
  // The pin is keyed to the card it was set on, so drawing the next card unpins without an effect.
  const [pinnedHintCardId, setPinnedHintCardId] = useState<string | null>(null);

  useEffect(() => { initializeGame(); }, [initializeGame]);

  const handleReset = () => {
    initializeGame();
    discard.clear();
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading…</div>
      </div>
    );
  }

  const { drawnCard } = gameState;
  const hintPinned = drawnCard !== undefined && pinnedHintCardId === drawnCard.id;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      {gameState.phase === "gameover" && <GameOverDialog gameState={gameState} onReset={handleReset} onCheat={cheat} />}
      {gameState.phase === "won" && <WonDialog cheatCount={gameState.cheatCount} onReset={handleReset} />}
      <header className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-yellow-400">Kings Corner</h1>
          <button
            onClick={handleReset}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            New Game
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4">
        <div className="text-center mb-6">
          <PileCounters gameState={gameState} />
          {gameState.phase === "cleared-grid" && (
            <p className="text-green-400 font-bold mt-2">
              {discard.selected ? "Click to discard" : "Click a card to discard (10s auto, others need pair)"}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-6">
          <Board
            gameState={gameState}
            isDiscardHighlighted={discard.isHighlighted}
            onCellClick={(row, col) => (drawnCard ? playCard(row, col) : discard.click(row, col))}
          />

          {drawnCard && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-zinc-400 text-sm">Click a grid cell to place this card</p>
              <div className="relative group">
                <CardComponent card={drawnCard} faceUp={true} />
                <button
                  onClick={() => setPinnedHintCardId(hintPinned ? null : drawnCard.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-zinc-700 hover:bg-zinc-500 text-zinc-300 text-xs flex items-center justify-center leading-none"
                  title="Placement hint"
                >
                  ?
                </button>
                <div className={hintPinned ? "block" : "hidden group-hover:block"}>
                  <div className="absolute top-0 left-full ml-2 z-10">
                    <CardPlacementHint card={drawnCard} gameState={gameState} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {gameState.phase === "cleared-grid" && (
            <button
              onClick={() => {
                discard.clear();
                resumePlaying();
              }}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
            >
              Done Discarding
            </button>
          )}

          <div className="bg-zinc-800 rounded-xl p-4 text-sm text-zinc-300">
            <h3 className="font-bold mb-2 text-white">Grid Rules:</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>Corners (4 spots): <span className="text-red-400">Kings (K)</span></div>
              <div>Top/Bottom edges (6 spots): <span className="text-pink-400">Queens (Q)</span></div>
              <div>Left/Right edges (6 spots): <span className="text-purple-400">Jacks (J)</span></div>
              <div>Center (4 spots): <span className="text-zinc-400">Any card (2-10)</span></div>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              <span className="text-green-400">●</span> Correct spot | <span className="text-red-500">●</span> Wrong spot
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
