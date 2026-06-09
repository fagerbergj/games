"use client";

import { useState } from "react";
import { useKingsCorner } from "./hooks/useKingsCorner";
import CardComponent from "./components/card";
import { findPairsAddingTo10, isValidGridPosition } from "./lib/validation";

export default function GamePage() {
  const {
    gameState,
    setGameState,
    initializeGame,
    playCard,
    resetGame,
    resumePlaying,
  } = useKingsCorner();

  const [playerName, setPlayerName] = useState<string>("Player");
  const [showSetup, setShowSetup] = useState(true);
  const [selectedDiscardCard, setSelectedDiscardCard] = useState<{ row: number; col: number } | null>(null);
  const [highlightedDiscardCards, setHighlightedDiscardCards] = useState<{ row: number; col: number }[]>([]);

  const handleStartGame = () => {
    initializeGame();
    setShowSetup(false);
  };

  const handleReset = () => {
    resetGame();
    setShowSetup(true);
    setSelectedDiscardCard(null);
    setHighlightedDiscardCards([]);
  };

  const getCardHighlightClass = (row: number, col: number) => {
    const cell = gameState?.grid[row][col];
    if (!cell) return "";
    
    const isCorner = (row === 0 && col === 0) ||
                     (row === 0 && col === 3) ||
                     (row === 3 && col === 0) ||
                     (row === 3 && col === 3);
    const isTopEdge = row === 0 && col > 0 && col < 3;
    const isBottomEdge = row === 3 && col > 0 && col < 3;
    const isLeftEdge = col === 0 && row > 0 && row < 3;
    const isRightEdge = col === 3 && row > 0 && row < 3;

    const isEdge = isCorner || isTopEdge || isBottomEdge || isLeftEdge || isRightEdge;

    if (!isEdge) return "";

    if (cell.rank === 13 && isCorner) return "ring-2 ring-green-400";
    if (cell.rank === 12 && (isTopEdge || isBottomEdge)) return "ring-2 ring-green-400";
    if (cell.rank === 11 && (isLeftEdge || isRightEdge)) return "ring-2 ring-green-400";

    return "ring-2 ring-red-500";
  };

  const isDiscardCardHighlighted = (row: number, col: number) => {
    return highlightedDiscardCards.some(p => p.row === row && p.col === col);
  };

  const handleDiscardClick = (row: number, col: number) => {
    if (!gameState || gameState.phase !== "cleared-grid") return;
    
    const cell = gameState.grid[row][col];
    if (!cell) return;

    if (cell.rank === 10) {
      const newGrid = gameState.grid.map((r) => [...r]);
      const discarded = newGrid[row][col]!;
      newGrid[row][col] = null;
      setGameState((prev) => {
        if (!prev) return null;
        return { ...prev, grid: newGrid, discardPile: [...prev.discardPile, discarded] };
      });
      setSelectedDiscardCard(null);
      setHighlightedDiscardCards([]);
    } else {
      if (selectedDiscardCard?.row === row && selectedDiscardCard?.col === col) {
        setSelectedDiscardCard(null);
        setHighlightedDiscardCards([]);
      } else if (selectedDiscardCard) {
        const selectedCell = gameState.grid[selectedDiscardCard.row][selectedDiscardCard.col];
        if (selectedCell && selectedCell.rank + cell.rank === 10) {
          const newGrid = gameState.grid.map((r) => [...r]);
          const discarded1 = newGrid[selectedDiscardCard.row][selectedDiscardCard.col]!;
          const discarded2 = newGrid[row][col]!;
          newGrid[selectedDiscardCard.row][selectedDiscardCard.col] = null;
          newGrid[row][col] = null;
          setGameState((prev) => prev ? { ...prev, grid: newGrid, discardPile: [...prev.discardPile, discarded1, discarded2] } : null);
          setSelectedDiscardCard(null);
          setHighlightedDiscardCards([]);
        } else {
          setSelectedDiscardCard({ row, col });
          const pairs = findPairsAddingTo10(gameState.grid);
          const matchingPairs = pairs.filter(pair => pair.some(p => p.row === row && p.col === col));
          const positions: { row: number; col: number }[] = [];
          matchingPairs.forEach(pair => pair.forEach(pos => positions.push(pos)));
          setHighlightedDiscardCards(positions);
        }
      } else {
        setSelectedDiscardCard({ row, col });
        const pairs = findPairsAddingTo10(gameState.grid);
        const matchingPairs = pairs.filter(pair => pair.some(p => p.row === row && p.col === col));
        const positions: { row: number; col: number }[] = [];
        matchingPairs.forEach(pair => pair.forEach(pos => positions.push(pos)));
        setHighlightedDiscardCards(positions);
      }
    }
  };

  if (gameState?.phase === "gameover") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            {gameState.deck.length === 0 ? "Out of Cards!" : "No Moves Available!"}
          </h1>
          <p className="text-xl mb-8">Better luck next time!</p>
          <button
            onClick={handleReset}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-6 rounded-lg"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  if (showSetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-900">
        <div className="w-full max-w-md p-8 text-center">
          <h1 className="text-4xl font-bold mb-8 text-yellow-400">Kings Corner</h1>
          <p className="mb-8 text-zinc-300">
            Fill the 4x4 grid with Kings on corners, Queens on top/bottom edges, Jacks on side edges.
            Win by clearing all cards!
          </p>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white mb-4"
            placeholder="Enter your name"
          />
          <button
            onClick={handleStartGame}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-6 rounded-lg"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
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
          <p className="text-xl text-zinc-300 mb-2">{playerName}'s Turn</p>
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="bg-zinc-800 text-zinc-400 text-sm px-3 py-1 rounded-full">
              Deck: <span className="font-bold text-white">{gameState?.deck.length ?? 0}</span>
            </span>
            <span className="bg-zinc-800 text-zinc-400 text-sm px-3 py-1 rounded-full">
              Discard: <span className="font-bold text-white">{gameState?.discardPile.length ?? 0}</span>
            </span>
          </div>
          {gameState?.phase === "cleared-grid" && (
            <p className="text-green-400 font-bold mt-2">
              {selectedDiscardCard ? "Click to discard" : "Click a card to discard (10s auto, others need pair)"}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="grid grid-cols-4 gap-1 bg-green-800 p-2 rounded-2xl border-4 border-green-900 justify-items-center">
            {gameState?.grid.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const cardClass = getCardHighlightClass(rowIndex, colIndex);
                const isDiscardHighlighted = isDiscardCardHighlighted(rowIndex, colIndex);
                const isValidDrop = !cell && gameState?.drawnCard &&
                  isValidGridPosition(gameState.drawnCard, gameState, rowIndex, colIndex);

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => {
                      if (gameState?.drawnCard) {
                        playCard(rowIndex, colIndex);
                      } else {
                        handleDiscardClick(rowIndex, colIndex);
                      }
                    }}
                    className={`
                      w-20 h-28 rounded-md flex items-center justify-center relative overflow-hidden cursor-pointer transition-all
                      ${cell ? "bg-zinc-100" : !gameState?.drawnCard || isValidDrop ? "bg-green-700/50 border-2 border-dashed border-green-600/50 hover:bg-green-700" : "bg-blue-700/50 border-2 border-dashed border-blue-500/50"}
                      ${cardClass}
                      ${isDiscardHighlighted ? "ring-4 ring-yellow-400 bg-yellow-500/30" : ""}
                    `}
                  >
                    {cell ? (
                      <CardComponent card={cell} faceUp={true} className={cardClass} />
                    ) : (
                      <span className="text-white/40 text-[10px] absolute bottom-1 left-1 right-1 text-center font-bold uppercase">
                        {getGridPositionLabel(rowIndex, colIndex)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {gameState?.drawnCard && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-zinc-400 text-sm">Click a grid cell to place this card</p>
              <CardComponent card={gameState.drawnCard} faceUp={true} />
            </div>
          )}

          {gameState?.phase === "cleared-grid" && (
            <button
              onClick={() => {
                setSelectedDiscardCard(null);
                setHighlightedDiscardCards([]);
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

function getGridPositionLabel(row: number, col: number): string {
  const isCorner = (row === 0 && col === 0) ||
                   (row === 0 && col === 3) ||
                   (row === 3 && col === 0) ||
                   (row === 3 && col === 3);

  const isTopEdge = row === 0 && col > 0 && col < 3;
  const isBottomEdge = row === 3 && col > 0 && col < 3;
  const isLeftEdge = col === 0 && row > 0 && row < 3;
  const isRightEdge = col === 3 && row > 0 && row < 3;

  if (isCorner) return "Kings";
  if (isTopEdge || isBottomEdge) return "Queens";
  if (isLeftEdge || isRightEdge) return "Jacks";
  return "Any";
}
