"use client"

import type { Placement as Ship } from "@game-rules/battleship";
import type { BattleshipSnapshot, ClientMessage } from "@game-rules/battleship/protocol";
import { useGameSocket } from "../../hooks/useGameSocket";
import RoomLobby, { BUTTON } from "../../components/room-lobby";
import Placement from "./components/placement";
import Battle from "./components/battle";

function Room({ room, send }: { room: BattleshipSnapshot; send: (m: ClientMessage) => void }) {
  const { you, phase, boards } = room;
  if (phase === "placing" && you.seat !== null && !boards[you.seat].ready) {
    const nobodyReady = !boards.some(b => b.ready);
    return (
      <Placement onReady={(fleet: Ship[]) => send({ type: "place", fleet })}
        salvo={you.isHost && nobodyReady ? { on: room.salvo, set: on => send({ type: "salvo", on }) } : undefined} />
    );
  }
  return <Battle room={room} send={send} />;
}

export default function BattleshipPage() {
  const { room, error, create, join, send, leave } = useGameSocket<BattleshipSnapshot, ClientMessage>("battleship");
  const opponent = room && room.you.seat !== null ? room.players[room.you.seat === 0 ? 1 : 0] : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="bg-zinc-900 border-b border-zinc-800 p-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-sky-400">
            Battleship{room && <> · Room <span data-testid="room-code" className="tracking-widest">{room.code}</span></>}
          </h1>
          {room && <button type="button" onClick={leave} className={`${BUTTON} bg-zinc-800 hover:bg-zinc-700 text-white`}>Leave</button>}
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center px-4 py-3 gap-3">
        {room ? (
          <>
            {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
            <p className="text-sm text-zinc-400">
              {room.you.seat === null ? "You're watching." : opponent
                ? `Playing ${opponent.name}${opponent.connected ? "" : " (disconnected)"}${room.salvo ? " · salvo rules" : ""}`
                : `Waiting for an opponent: share code ${room.code}`}
            </p>
            <Room room={room} send={send} />
          </>
        ) : (
          <RoomLobby onCreate={create} onJoin={join} error={error} />
        )}
      </main>
    </div>
  );
}
