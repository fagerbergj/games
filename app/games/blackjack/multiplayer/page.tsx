"use client"

import { useEffect, useState } from "react";
import { isBlackjack, decksRemaining, trueCount, type Seat } from "@game-rules/blackjack";
import type { ClientMessage, Move, RoomSnapshot } from "@game-rules/blackjack/protocol";
import { useGameSocket } from "../hooks/useGameSocket";
import { getCountVisible, saveCountVisible } from "../lib/settings";
import DealerHand from "../components/dealer-hand";
import SeatPanel from "../components/seat-panel";

type Send = (m: ClientMessage) => void;

const BUTTON = "min-h-11 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed";

function Lobby({ onCreate, onJoin, error }: { onCreate: (name: string) => void; onJoin: (code: string, name: string) => void; error: string | null }) {
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

function SeatPicker({ room, send }: { room: RoomSnapshot; send: Send }) {
  const dealtIn = new Set(room.table.seats.map(s => s.id));
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {room.slots.map((slot, i) => {
        const tag = slot && [
          room.you.seat === i && "you",
          slot.host && "host",
          !slot.connected && "away",
          room.table.phase !== "betting" && !dealtIn.has(`slot-${i}`) && "sitting out",
        ].filter(Boolean).join(", ");
        return slot ? (
          <span key={i} className="min-h-11 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
            {i + 1}. {slot.name}{tag && <span className="text-zinc-500"> ({tag})</span>}
          </span>
        ) : (
          <button key={i} type="button" onClick={() => send({ type: "sit", seat: i })}
            className={`${BUTTON} border border-dashed border-white/30 text-zinc-300 hover:bg-white/10`}>
            Sit in seat {i + 1}
          </button>
        );
      })}
    </div>
  );
}

function statusLine({ table }: RoomSnapshot): string {
  if (table.seats.length === 0) return "Take a seat";
  switch (table.phase) {
    case "betting": return "Place your bets";
    case "insurance": return "Insurance — dealer shows an ace";
    case "playerTurns": return `${table.seats[table.activeSeatIndex]?.label ?? ""}'s turn`;
    case "dealerTurn": return "Dealer's turn";
    default: return "Round over";
  }
}

function Table({ room, send }: { room: RoomSnapshot; send: Send }) {
  const [countVisible, setCountVisible] = useState(false);
  const [countOpen, setCountOpen] = useState<string | null>(null);
  // Read after mount so the first render matches SSR.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time adoption of a stored preference
  useEffect(() => setCountVisible(getCountVisible()), []);

  const { table, count, you } = room;
  const decksLeft = decksRemaining(table.shoeRemaining);
  const dealerHasBlackjack = table.phase === "result" && isBlackjack(table.dealerHand);
  const act = (action: Move) => () => send({ type: "action", action });
  const seatProps = (seat: Seat, i: number) => {
    const mine = you.seat !== null && seat.id === `slot-${you.seat}`;
    return {
      seat, phase: table.phase, readOnly: !mine, dealerHasBlackjack, houseRules: table.houseRules,
      isActiveSeat: table.phase === "playerTurns" ? i === table.activeSeatIndex : true,
      actions: mine ? you.actions : null,
      dealerUpCard: table.dealerHand[0],
      onPlaceBet: (amount: number) => send({ type: "bet", amount }),
      onHit: act("hit"), onStand: act("stand"), onDouble: act("double"), onSplit: act("split"), onSurrender: act("surrender"),
      onTakeInsurance: act("insurance"), onDeclineInsurance: act("declineInsurance"), onTakeEvenMoney: act("evenMoney"),
      onResetBankroll: act("buyBackIn"), onBuyBackIn: act("buyBackIn"),
      runningCount: count.running, trueCount: trueCount(count.running, decksLeft), decksRemaining: decksLeft,
      lastCountedCard: count.lastCard, justReshuffled: count.justReshuffled, countVisible,
      onToggleCountVisible: () => setCountVisible(v => { saveCountVisible(!v); return !v; }),
      countOpen: countOpen === seat.id,
      onToggleCount: () => setCountOpen(o => (o === seat.id ? null : seat.id)),
      onCloseCount: () => setCountOpen(o => (o === seat.id ? null : o)),
    };
  };

  return (
    <div data-testid="felt-table"
      className="w-full max-w-6xl rounded-[2rem] sm:rounded-[2.5rem] border-4 sm:border-8 border-zinc-900 shadow-2xl px-3 sm:px-10 py-3 sm:py-4 flex flex-col gap-3 bg-[radial-gradient(ellipse_at_center,_#0f3d24_0%,_#0a2c1a_60%,_#071f12_100%)]">
      <SeatPicker room={room} send={send} />
      <DealerHand cards={table.dealerHand} />
      <p className="text-zinc-400 text-sm text-center h-5">{statusLine(room)}</p>
      <div className={`grid gap-4 ${table.seats.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""} border-t border-white/10 pt-2`}>
        {table.seats.map((seat, i) => <SeatPanel key={seat.id} {...seatProps(seat, i)} />)}
      </div>
    </div>
  );
}

function HostControls({ room, send }: { room: RoomSnapshot; send: Send }) {
  const { phase, seats } = room.table;
  // Not just the host: anyone may direct the table while the host is disconnected.
  if (!room.you.canDirect) return null;
  if (phase === "result") {
    return <button type="button" onClick={() => send({ type: "newRound" })} className={`${BUTTON} bg-yellow-500 hover:bg-yellow-600 text-black`}>New Round</button>;
  }
  if (phase !== "betting") return null;
  return (
    <button type="button" onClick={() => send({ type: "start" })} disabled={!seats.some(s => s.pendingBet > 0)}
      title="Deal now; seats without a bet sit this round out" className={`${BUTTON} bg-yellow-500 hover:bg-yellow-600 text-black`}>
      Deal
    </button>
  );
}

export default function MultiplayerBlackjackPage() {
  const { room, error, create, join, send, leave } = useGameSocket();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="bg-zinc-900 border-b border-zinc-800 p-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-green-400">
            Blackjack{room && <> · Room <span data-testid="room-code" className="tracking-widest">{room.code}</span></>}
          </h1>
          {room && (
            <div className="flex items-center gap-2">
              <HostControls room={room} send={send} />
              <button type="button" onClick={leave} className={`${BUTTON} bg-zinc-800 hover:bg-zinc-700 text-white`}>Leave</button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center p-3 gap-2">
        {room ? (
          <>
            {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
            <Table room={room} send={send} />
          </>
        ) : (
          <Lobby onCreate={create} onJoin={join} error={error} />
        )}
      </main>
    </div>
  );
}
