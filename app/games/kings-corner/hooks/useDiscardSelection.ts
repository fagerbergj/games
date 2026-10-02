import { useState, type Dispatch, type SetStateAction } from "react";
import type { GameState } from "../lib/types";
import { findPairsAddingTo10 } from "../lib/validation";

type Pos = { row: number; col: number };

/** Click-to-discard during the cleared-grid phase: 10s clear alone, other cards clear in pairs summing to 10. */
export function useDiscardSelection(
  gameState: GameState | null,
  setGameState: Dispatch<SetStateAction<GameState | null>>,
) {
  const [selected, setSelected] = useState<Pos | null>(null);
  const [highlighted, setHighlighted] = useState<Pos[]>([]);

  const clear = () => {
    setSelected(null);
    setHighlighted([]);
  };

  const discard = (gs: GameState, positions: Pos[]) => {
    const grid = gs.grid.map(r => [...r]);
    const removed = positions.map(p => grid[p.row][p.col]!);
    positions.forEach(p => { grid[p.row][p.col] = null; });
    setGameState(prev => (prev ? { ...prev, grid, discardPile: [...prev.discardPile, ...removed] } : null));
    clear();
  };

  const select = (gs: GameState, pos: Pos) => {
    setSelected(pos);
    setHighlighted(
      findPairsAddingTo10(gs.grid)
        .filter(pair => pair.some(p => p.row === pos.row && p.col === pos.col))
        .flat(),
    );
  };

  const click = (row: number, col: number) => {
    if (!gameState || gameState.phase !== "cleared-grid") return;
    const cell = gameState.grid[row][col];
    if (!cell) return;
    const pos = { row, col };
    if (cell.rank === 10) return discard(gameState, [pos]);
    if (selected?.row === row && selected.col === col) return clear();
    const selectedCell = selected && gameState.grid[selected.row][selected.col];
    if (selected && selectedCell && selectedCell.rank + cell.rank === 10) return discard(gameState, [selected, pos]);
    select(gameState, pos);
  };

  const isHighlighted = (row: number, col: number) => highlighted.some(p => p.row === row && p.col === col);

  return { selected, click, clear, isHighlighted };
}
