import type { Card, GameState } from "./types";
import { getCardSymbol } from "./deck";
import { requiredEdgeRank } from "./validation";

const GRID_LABELS: Record<number, string> = { 13: "Kings", 12: "Queens", 11: "Jacks" };
const SHORT_LABELS: Record<number, string> = { 13: "K", 12: "Q", 11: "J" };

export function getGridPositionLabel(row: number, col: number): string {
  return GRID_LABELS[requiredEdgeRank(row, col) ?? 0] ?? "Any";
}

function getPositionLabel(row: number, col: number): string {
  return SHORT_LABELS[requiredEdgeRank(row, col) ?? 0] ?? "M";
}

/** Ring class marking a placed card as in (green) or out of (red) its winning edge slot; "" off the edges. */
export function getCardHighlightClass(card: Card | null | undefined, row: number, col: number): string {
  const required = requiredEdgeRank(row, col);
  if (!card || required === null) return "";
  return card.rank === required ? "ring-2 ring-green-400" : "ring-2 ring-red-500";
}

export function getRankCounts(rank: number, gameState: GameState): { boardPositions: string[]; discard: number; deck: number } {
  const boardPositions: string[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (gameState.grid[r][c]?.rank === rank) boardPositions.push(getPositionLabel(r, c));
    }
  }
  const discard = gameState.discardPile.filter(c => c.rank === rank).length;
  const isDrawn = gameState.drawnCard?.rank === rank ? 1 : 0;
  return { boardPositions, discard, deck: 4 - boardPositions.length - discard - isDrawn };
}

export function getPairRank(rank: number): number | null {
  if (rank >= 1 && rank <= 9) return 10 - rank;
  return null;
}

export function getCardCounts(cards: Card[]): { rank: number; symbol: string; count: number }[] {
  const counts = new Map<number, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([rank, count]) => ({ rank, symbol: getCardSymbol(rank), count }));
}
