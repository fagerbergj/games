"use client";

import { useEffect, useState } from "react";
import { shipCells, type Coord, type Seat } from "@game-rules/battleship";
import type { BattleshipSnapshot, ClientMessage, PublicBoard } from "@game-rules/battleship/protocol";
import { BUTTON } from "../../../components/room-lobby";
import Grid, { type CellLook } from "./grid";

const same = (a: Coord, b: Coord) => a.row === b.row && a.col === b.col;

function cellLook(board: PublicBoard, c: Coord, aiming: boolean): CellLook {
  const shot = board.shots.find(s => same(s, c));
  const ship = board.ships.find(p => shipCells(p).some(s => same(s, c)));
  const sunk = ship && shipCells(ship).every(s => board.shots.some(x => x.hit && same(x, s)));
  if (shot?.hit) return { status: sunk ? `sunk ${ship.ship}` : "hit", mark: "✕", className: sunk ? "bg-red-900 text-red-200" : "bg-red-600 text-white" };
  if (shot) return { status: "miss", mark: "•", className: "bg-sky-950 text-sky-300" };
  if (aiming) return { status: "selected", mark: "◎", className: "bg-yellow-500/70 text-black" };
  if (ship) return { status: ship.ship, className: "bg-zinc-400" };
  return { status: "water", className: "bg-sky-900/70" };
}

/** Counts down locally from the server's figure, which is only sent when the turn changes. */
function useCountdown(msLeft: number | null) {
  const [left, setLeft] = useState(msLeft);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-sync to each new snapshot's clock
    setLeft(msLeft);
    if (msLeft === null) return;
    const start = Date.now();
    const id = setInterval(() => setLeft(Math.max(0, msLeft - (Date.now() - start))), 1000);
    return () => clearInterval(id);
  }, [msLeft]);
  return left === null ? null : Math.ceil(left / 1000);
}

function status(room: BattleshipSnapshot, names: string[]): string {
  const { phase, turn, winner, you } = room;
  const name = (s: Seat) => (you.seat === s ? "You" : names[s]);
  if (phase === "placing") return "Waiting for both fleets to be placed";
  if (phase === "over") return winner === you.seat ? "You won!" : `${name(winner!)} won`;
  if (turn !== you.seat) return `${names[turn]}'s turn`;
  return room.shotsAllowed > 1 ? `Your turn: fire ${room.shotsAllowed} shots` : "Your turn: fire!";
}

export default function Battle({ room, send }: { room: BattleshipSnapshot; send: (m: ClientMessage) => void }) {
  const [aimed, setAim] = useState<Coord[]>([]);
  const seconds = useCountdown(room.turnMsLeft);
  const { you, boards, phase, turn, shotsAllowed } = room;
  const names = room.players.map((p, i) => p?.name ?? `Seat ${i + 1}`);
  const mine = you.seat;
  const foe: Seat = mine === 1 ? 0 : 1;
  const myTurn = phase === "playing" && turn === mine;
  // Aimed cells drop out once fired on, so a landed salvo clears itself.
  const aim = aimed.filter(c => !boards[foe].shots.some(s => same(s, c)));

  const fire = (targets: Coord[]) => send({ type: "fire", targets });
  const target = (c: Coord) => {
    if (!myTurn || boards[foe].shots.some(s => same(s, c))) return;
    if (shotsAllowed === 1) return fire([c]);
    setAim(aim.some(x => same(x, c)) ? aim.filter(x => !same(x, c)) : aim.length < shotsAllowed ? [...aim, c] : aim);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl">
      <p role="status" className="text-lg font-bold text-center">
        {status(room, names)}
        {seconds !== null && <span className="ml-2 text-sm font-normal text-zinc-400">{seconds}s left</span>}
      </p>
      {myTurn && shotsAllowed > 1 && (
        <button type="button" disabled={aim.length !== shotsAllowed} onClick={() => fire(aim)}
          className={`${BUTTON} bg-red-600 hover:bg-red-700 text-white`}>
          Fire salvo ({aim.length}/{shotsAllowed})
        </button>
      )}
      <div className="flex flex-col lg:flex-row gap-6 w-full items-center lg:items-start justify-center">
        <section className="flex flex-col items-center gap-2 w-full max-w-[26rem]">
          <h2 className="text-sm font-bold text-zinc-300">{mine === null ? `${names[1]}'s waters` : `Enemy waters (${names[foe]})`}</h2>
          <Grid label={mine === null ? `${names[1]}'s board` : "Enemy board"} onActivate={myTurn ? target : undefined}
            look={c => cellLook(boards[foe], c, aim.some(a => same(a, c)))} />
        </section>
        <section className="flex flex-col items-center gap-2 w-full max-w-[26rem]">
          <h2 className="text-sm font-bold text-zinc-300">{mine === null ? `${names[0]}'s waters` : "Your fleet"}</h2>
          <Grid label={mine === null ? `${names[0]}'s board` : "Your board"} look={c => cellLook(boards[mine ?? 0], c, false)} />
        </section>
      </div>
      {phase === "over" && mine !== null && (
        <button type="button" onClick={() => send({ type: "rematch" })} className={`${BUTTON} bg-yellow-500 hover:bg-yellow-600 text-black`}>
          Play again
        </button>
      )}
    </div>
  );
}
