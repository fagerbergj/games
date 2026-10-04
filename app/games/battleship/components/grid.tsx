"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { BOARD_SIZE, type Coord } from "@game-rules/battleship";

const COLS = "ABCDEFGHIJ";
const INDEXES = Array.from({ length: BOARD_SIZE }, (_, i) => i);
export const cellName = ({ row, col }: Coord) => `${COLS[col]}${row + 1}`;

const MOVES: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
const clamp = (n: number) => Math.min(BOARD_SIZE - 1, Math.max(0, n));

export interface CellLook {
  /** Read after the cell name, e.g. "hit" or "carrier". */
  status: string;
  className: string;
  mark?: string;
}

interface GridProps {
  label: string;
  look: (c: Coord) => CellLook;
  /** Click, Enter or Space on a cell. Without it the board is read-only. */
  onActivate?: (c: Coord) => void;
  /** The cell under the pointer or keyboard focus, for placement previews. */
  onPoint?: (c: Coord | null) => void;
  onDropShip?: (c: Coord, ship: string) => void;
  /** Extra keys, e.g. R to rotate; return true when handled. */
  onKey?: (key: string) => boolean;
}

/** A 10x10 board. One cell is tabbable at a time and arrow keys move between cells. */
export default function Grid({ label, look, onActivate, onPoint, onDropShip, onKey }: GridProps) {
  const [focus, setFocus] = useState<Coord>({ row: 0, col: 0 });
  const cells = useRef<(HTMLButtonElement | null)[]>([]);

  const keyDown = (e: KeyboardEvent, c: Coord) => {
    const step = MOVES[e.key];
    if (step) {
      e.preventDefault();
      const next = { row: clamp(c.row + step[0]), col: clamp(c.col + step[1]) };
      setFocus(next);
      onPoint?.(next);
      cells.current[next.row * BOARD_SIZE + next.col]?.focus();
    } else if (onKey?.(e.key)) {
      e.preventDefault();
    }
  };
  const drop = (e: DragEvent, c: Coord) => {
    e.preventDefault();
    onDropShip?.(c, e.dataTransfer.getData("text/plain"));
  };

  return (
    <div role="grid" aria-label={label} onMouseLeave={() => onPoint?.(null)}
      className="grid w-full max-w-[26rem] grid-cols-[1.25rem_repeat(10,minmax(0,1fr))] gap-px select-none">
      <div role="row" className="contents">
        <span role="columnheader" aria-hidden />
        {INDEXES.map(col => <span key={col} role="columnheader" className="text-center text-xs text-zinc-500">{COLS[col]}</span>)}
      </div>
      {INDEXES.map(row => (
        <div key={row} role="row" className="contents">
          <span role="rowheader" className="self-center text-right pr-1 text-xs text-zinc-500">{row + 1}</span>
          {INDEXES.map(col => {
            const c = { row, col };
            const { status, className, mark } = look(c);
            const focused = focus.row === row && focus.col === col;
            return (
              <div key={col} role="gridcell" className="aspect-square">
                <button type="button" ref={el => { cells.current[row * BOARD_SIZE + col] = el; }}
                  tabIndex={focused ? 0 : -1} aria-label={`${cellName(c)}, ${status}`} aria-disabled={!onActivate}
                  onClick={() => { setFocus(c); onActivate?.(c); }}
                  onFocus={() => { setFocus(c); onPoint?.(c); }} onMouseEnter={() => onPoint?.(c)}
                  onKeyDown={e => keyDown(e, c)}
                  onDragOver={onDropShip ? e => { e.preventDefault(); onPoint?.(c); } : undefined}
                  onDrop={onDropShip ? e => drop(e, c) : undefined}
                  className={`w-full h-full rounded-sm text-xs font-bold flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 ${className}`}>
                  {mark}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
