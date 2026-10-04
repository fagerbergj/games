"use client";

import { useState } from "react";
import { BOARD_SIZE, FLEET, randomFleet, shipCells, type Coord, type Placement as Ship, type ShipId } from "@game-rules/battleship";
import { BUTTON } from "../../../components/room-lobby";
import Grid, { type CellLook } from "./grid";

const same = (a: Coord, b: Coord) => a.row === b.row && a.col === b.col;
const inBounds = ({ row, col }: Coord) => row >= 0 && col >= 0 && row < BOARD_SIZE && col < BOARD_SIZE;

interface PlacementProps {
  onReady: (fleet: Ship[]) => void;
  /** Shown to the host, who may switch the salvo variant before anyone commits a fleet. */
  salvo?: { on: boolean; set: (on: boolean) => void };
}

/** Lay out the fleet: pick a ship (or drag it), point at its top-left cell, R or Rotate to turn it. */
export default function Placement({ onReady, salvo }: PlacementProps) {
  const [placed, setPlaced] = useState<Ship[]>([]);
  const [selected, setSelected] = useState<ShipId | null>(FLEET[0].id);
  const [vertical, setVertical] = useState(false);
  const [point, setPoint] = useState<Coord | null>(null);

  const others = (ship: ShipId | null) => placed.filter(p => p.ship !== ship);
  const fits = (p: Ship) => {
    const taken = others(p.ship).flatMap(shipCells);
    return shipCells(p).every(c => inBounds(c) && !taken.some(t => same(t, c)));
  };
  const nextUnplaced = (fleet: Ship[]) => FLEET.find(s => !fleet.some(p => p.ship === s.id))?.id ?? null;

  const place = (ship: ShipId, at: Coord) => {
    const p = { ship, ...at, vertical };
    if (!fits(p)) return;
    const fleet = [...others(ship), p];
    setPlaced(fleet);
    setSelected(nextUnplaced(fleet));
  };
  const pickUp = (ship: ShipId) => {
    const p = placed.find(q => q.ship === ship);
    if (p) setVertical(p.vertical);
    setPlaced(others(ship));
    setSelected(ship);
  };
  // A ship's own cell can never be a free anchor, so clicking a placed ship always means "move it".
  const activate = (c: Coord) => {
    const hit = placed.find(p => shipCells(p).some(s => same(s, c)));
    if (hit) pickUp(hit.ship);
    else if (selected) place(selected, c);
  };

  const preview = selected && point ? { ship: selected, ...point, vertical } : null;
  const previewOk = preview ? fits(preview) : false;
  const look = (c: Coord): CellLook => {
    const ship = placed.find(p => shipCells(p).some(s => same(s, c)));
    if (preview && shipCells(preview).some(s => same(s, c))) {
      return { status: previewOk ? `place ${preview.ship} here` : "doesn't fit", className: previewOk ? "bg-emerald-500/70" : "bg-red-500/60" };
    }
    return ship ? { status: ship.ship, className: "bg-zinc-400 text-zinc-900" } : { status: "water", className: "bg-sky-900/70 hover:bg-sky-800" };
  };
  const rotate = () => setVertical(v => !v);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start w-full max-w-4xl">
      <Grid label="Your fleet: placement" look={look} onActivate={activate} onPoint={setPoint}
        onDropShip={(c, ship) => FLEET.some(s => s.id === ship) && place(ship as ShipId, c)}
        onKey={key => (key === "r" || key === "R" ? (rotate(), true) : false)} />
      <div className="flex flex-col gap-3 w-full max-w-[26rem]">
        <p className="text-sm text-zinc-400">
          Pick a ship, then a cell for its {vertical ? "top" : "left"} end. Press R to rotate. Click a placed ship to move it.
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Ships">
          {FLEET.map(({ id, length }) => {
            const done = placed.some(p => p.ship === id);
            return (
              <li key={id}>
                <button type="button" draggable aria-pressed={selected === id}
                  onDragStart={e => { e.dataTransfer.setData("text/plain", id); setSelected(id); }}
                  onClick={() => (done ? pickUp(id) : setSelected(id))}
                  className={`${BUTTON} border ${selected === id ? "border-yellow-400 bg-yellow-400/10" : "border-white/15"} ${done ? "text-zinc-500" : ""}`}>
                  {id} ({length}){done && " ✓"}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={rotate} className={`${BUTTON} bg-zinc-700 hover:bg-zinc-600`}>Rotate ({vertical ? "vertical" : "horizontal"})</button>
          <button type="button" onClick={() => { setPlaced(randomFleet(Math.random)); setSelected(null); }} className={`${BUTTON} bg-zinc-700 hover:bg-zinc-600`}>Random</button>
          <button type="button" onClick={() => { setPlaced([]); setSelected(FLEET[0].id); }} className={`${BUTTON} bg-zinc-800 hover:bg-zinc-700`}>Clear</button>
        </div>
        {salvo && (
          <label className="flex items-center gap-2 text-sm min-h-11">
            <input type="checkbox" checked={salvo.on} onChange={e => salvo.set(e.target.checked)} className="w-5 h-5" />
            Salvo: one shot per ship you have afloat
          </label>
        )}
        <button type="button" disabled={placed.length !== FLEET.length} onClick={() => onReady(placed)}
          className={`${BUTTON} bg-yellow-500 hover:bg-yellow-600 text-black`}>
          Ready
        </button>
      </div>
    </div>
  );
}
