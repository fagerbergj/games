"use client";

import { useState } from "react";

export const BUTTON = "min-h-11 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed";

/** Name entry plus create-or-join-by-code, shared by every multiplayer game. */
export default function RoomLobby({ onCreate, onJoin, error }: { onCreate: (name: string) => void; onJoin: (code: string, name: string) => void; error: string | null }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return (
    <div className="max-w-sm mx-auto mt-16 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-zinc-300">
        Your name
        <input value={name} onChange={e => setName(e.target.value)} maxLength={20}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100" />
      </label>
      <button type="button" onClick={() => onCreate(name)} className={`${BUTTON} bg-yellow-500 hover:bg-yellow-600 text-black`}>
        Create room
      </button>
      <div className="flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} aria-label="Room code"
          placeholder="ROOM CODE" className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 tracking-widest uppercase" />
        <button type="button" onClick={() => onJoin(code, name)} disabled={code.length !== 6}
          className={`${BUTTON} bg-zinc-700 hover:bg-zinc-600 text-white`}>
          Join
        </button>
      </div>
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
