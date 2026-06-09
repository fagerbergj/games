import { useState, useCallback } from "react";
import { createDeck, drawCard, shuffle } from "../lib/deck";
import { isValidGridPosition } from "../lib/validation";
import { GameState, Card } from "../lib/types";

function canPlaceAnywhere(card: Card, grid: (Card | null)[][]): boolean {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (isValidGridPosition(card, { grid } as GameState, r, c)) return true;
    }
  }
  return false;
}

export function useKingsCorner() {
  const [gameState, setGameState] = useState<GameState | null>(null);

  const initializeGame = useCallback(() => {
    const deck = createDeck();
    const initialGrid: (Card | null)[][] = Array(4).fill(null).map(() => Array(4).fill(null));
    const firstCard = drawCard(deck);

    setGameState({
      id: `game-${Date.now()}`,
      players: [{ id: "player-1", name: "Player", hand: [], score: 0 }],
      deck,
      discardPile: [],
      currentTurn: 0,
      phase: firstCard && !canPlaceAnywhere(firstCard, initialGrid) ? "gameover" : "playing",
      grid: initialGrid,
      drawnCard: firstCard,
    });
  }, []);

  const playCard = useCallback(
    (row: number, col: number) => {
      if (!gameState || !gameState.drawnCard) return;
      const card = gameState.drawnCard;
      if (!isValidGridPosition(card, gameState, row, col)) return;

      const newGrid = gameState.grid.map((r) => [...r]);
      newGrid[row][col] = card;

      const gridFull = newGrid.every((r) => r.every((cell) => cell !== null));
      if (gridFull) {
        setGameState((prev) => prev ? { ...prev, grid: newGrid, drawnCard: undefined, phase: "cleared-grid" } : null);
        return;
      }

      const newDeck = [...gameState.deck];
      const nextCard = drawCard(newDeck);

      if (!nextCard || !canPlaceAnywhere(nextCard, newGrid)) {
        setGameState((prev) => prev ? { ...prev, grid: newGrid, deck: newDeck, drawnCard: nextCard ?? undefined, phase: "gameover" } : null);
        return;
      }

      setGameState((prev) => prev ? { ...prev, grid: newGrid, deck: newDeck, drawnCard: nextCard } : null);
    },
    [gameState]
  );

  const resetGame = useCallback(() => {
    setGameState(null);
  }, []);

  const cheat = useCallback(() => {
    setGameState((prev) => {
      if (!prev) return null;
      const gridCards = prev.grid.flat().filter((c): c is Card => c !== null);
      const newDeck = shuffle([...prev.deck, ...prev.discardPile, ...gridCards]);
      const newGrid: (Card | null)[][] = Array(4).fill(null).map(() => Array(4).fill(null));
      const nextCard = drawCard(newDeck);
      const phase = !nextCard || !canPlaceAnywhere(nextCard, newGrid) ? "gameover" : "playing";
      return { ...prev, deck: newDeck, discardPile: [], grid: newGrid, drawnCard: nextCard ?? undefined, cheated: true, phase };
    });
  }, []);

  const resumePlaying = useCallback(() => {
    setGameState((prev) => {
      if (!prev) return null;
      const newDeck = [...prev.deck];
      const nextCard = drawCard(newDeck);
      if (!nextCard || !canPlaceAnywhere(nextCard, prev.grid)) {
        return { ...prev, deck: newDeck, drawnCard: nextCard ?? undefined, phase: "gameover" };
      }
      return { ...prev, deck: newDeck, drawnCard: nextCard, phase: "playing" };
    });
  }, []);

  return {
    gameState,
    setGameState,
    initializeGame,
    playCard,
    resetGame,
    resumePlaying,
    cheat,
  };
}
