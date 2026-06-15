import { Card, GameState } from "./types";

export function isValidKingPlacement(
  card: Card,
  gameState: GameState,
  row: number,
  col: number
): boolean {
  // Kings must go in corners
  const isCorner = (row === 0 && col === 0) ||
                   (row === 0 && col === 3) ||
                   (row === 3 && col === 0) ||
                   (row === 3 && col === 3);
  
  return card.rank === 13 && isCorner;
}

export function isValidQueenPlacement(
  card: Card,
  gameState: GameState,
  row: number,
  col: number
): boolean {
  // Queens must go on top (row 0) or bottom (row 3) edges, not corners
  const isEdge = (row === 0 || row === 3) && col > 0 && col < 3;
  
  return card.rank === 12 && isEdge;
}

export function isValidJackPlacement(
  card: Card,
  gameState: GameState,
  row: number,
  col: number
): boolean {
  // Jacks must go on left (col 0) or right (col 3) edges, not corners
  const isEdge = (col === 0 || col === 3) && row > 0 && row < 3;
  
  return card.rank === 11 && isEdge;
}

export function isValidGridPosition(
  card: Card,
  gameState: GameState,
  row: number,
  col: number
): boolean {
  // Check if spot is empty
  if (gameState.grid[row][col] !== null) {
    return false;
  }

  // Kings must go in corners
  if (card.rank === 13) {
    return isValidKingPlacement(card, gameState, row, col);
  }

  // Queens must go on top/bottom edges (not corners)
  if (card.rank === 12) {
    return isValidQueenPlacement(card, gameState, row, col);
  }

  // Jacks must go on left/right edges (not corners)
  if (card.rank === 11) {
    return isValidJackPlacement(card, gameState, row, col);
  }

  // Number cards (2-10) go anywhere in the center
  return true;
}

export function isGridFull(grid: (Card | null)[][]): boolean {
  return grid.every((row) => row.every((cell) => cell !== null));
}

// Win condition: every edge space is filled with its required face card —
// Kings in the corners, Queens on top/bottom edges, Jacks on left/right edges.
// The center number cards are irrelevant to winning.
export function areEdgesComplete(grid: (Card | null)[][]): boolean {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const isCorner = (row === 0 || row === 3) && (col === 0 || col === 3);
      const isTopBottomEdge = (row === 0 || row === 3) && col > 0 && col < 3;
      const isLeftRightEdge = (col === 0 || col === 3) && row > 0 && row < 3;
      const cell = grid[row][col];

      if (isCorner && cell?.rank !== 13) return false;
      if (isTopBottomEdge && cell?.rank !== 12) return false;
      if (isLeftRightEdge && cell?.rank !== 11) return false;
    }
  }
  return true;
}

export function clearGrid(grid: (Card | null)[][]): (Card | null)[][] {
  return grid.map((row) => row.map(() => null));
}

export function isGameFinished(gameState: GameState): boolean {
  // Check if grid is empty (all cleared)
  if (gameState.phase === "cleared-grid") {
    return gameState.grid.every((row) => row.every((cell) => cell === null));
  }

  // Game over if deck is empty and no drawn card
  if (gameState.phase === "gameover") {
    return true;
  }

  return false;
}

export function calculateScore(hand: Card[]): number {
  return hand.reduce((total, card) => {
    if (card.rank === 13) return total + 10;
    if (card.rank === 11 || card.rank === 12) return total + 10;
    return total + card.rank;
  }, 0);
}

export function findPairsAddingTo10(grid: (Card | null)[][]): { row: number; col: number }[][] {
  const pairs: { row: number; col: number }[][] = [];
  const cards: { row: number; col: number; rank: number }[] = [];

  // Flatten grid and collect cards
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const card = grid[row][col];
      if (card) {
        cards.push({ row, col, rank: card.rank });
      }
    }
  }

  // Find pairs adding to 10
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i].rank + cards[j].rank === 10) {
        pairs.push([{ row: cards[i].row, col: cards[i].col }, { row: cards[j].row, col: cards[j].col }]);
      }
    }
  }

  // Find single 10s
  const single10s = cards.filter(c => c.rank === 10).map(c => ({ row: c.row, col: c.col }));
  for (const card of single10s) {
    pairs.push([card]);
  }

  return pairs;
}
