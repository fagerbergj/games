import type { GameState } from "../lib/types";
import CardComponent from "./card";
import { isValidGridPosition } from "../lib/validation";
import { getCardHighlightClass, getGridPositionLabel } from "../lib/positions";

interface Props {
  gameState: GameState;
  isDiscardHighlighted: (row: number, col: number) => boolean;
  onCellClick: (row: number, col: number) => void;
}

function emptyCellClass(gameState: GameState, row: number, col: number): string {
  const droppable = !gameState.drawnCard || isValidGridPosition(gameState.drawnCard, gameState, row, col);
  return droppable
    ? "bg-green-700/50 border-2 border-dashed border-green-600/50 hover:bg-green-700"
    : "bg-blue-700/50 border-2 border-dashed border-blue-500/50";
}

export default function Board({ gameState, isDiscardHighlighted, onCellClick }: Props) {
  return (
    <div className="grid grid-cols-4 gap-1 bg-green-800 p-2 rounded-2xl border-4 border-green-900 justify-items-center">
      {gameState.grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const cardClass = getCardHighlightClass(cell, rowIndex, colIndex);
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              onClick={() => onCellClick(rowIndex, colIndex)}
              className={`
                w-20 h-28 rounded-md flex items-center justify-center relative overflow-hidden cursor-pointer transition-all
                ${cell ? "bg-zinc-100" : emptyCellClass(gameState, rowIndex, colIndex)}
                ${cardClass}
                ${isDiscardHighlighted(rowIndex, colIndex) ? "ring-4 ring-yellow-400 bg-yellow-500/30" : ""}
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
  );
}
