// @vitest-environment node
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import type { Card } from "@game-rules/blackjack";
import type { ClientMessage, RoomSnapshot, ServerMessage } from "@game-rules/blackjack/protocol";
import { startGameServer } from "../server";

type Server = ReturnType<typeof startGameServer>;

/** A ws client that records every frame and can await the first one matching a predicate. */
async function connect(url: string) {
  const ws = new WebSocket(url);
  const seen: ServerMessage[] = [];
  const waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  ws.on("message", data => {
    const m = JSON.parse(data.toString()) as ServerMessage;
    seen.push(m);
    for (const w of waiters.filter(w => w.pred(m))) {
      waiters.splice(waiters.indexOf(w), 1);
      w.resolve(m);
    }
  });
  await new Promise(resolve => ws.once("open", resolve));
  const next = (pred: (m: ServerMessage) => boolean) => new Promise<ServerMessage>(resolve => waiters.push({ pred, resolve }));
  return {
    ws, seen,
    send: (m: ClientMessage | string) => ws.send(typeof m === "string" ? m : JSON.stringify(m)),
    next,
    state: (pred: (r: RoomSnapshot) => boolean) =>
      next(m => m.type === "state" && pred(m.room)).then(m => (m as Extract<ServerMessage, { type: "state" }>).room),
  };
}

let server: Server;
let url: string;

beforeEach(async () => {
  server = startGameServer({ port: 0, beatMs: 5 });
  await new Promise(resolve => server.wss.once("listening", resolve));
  url = `ws://127.0.0.1:${(server.wss.address() as AddressInfo).port}/ws`;
});
afterEach(() => server.close());

test("two players play a full round over real sockets", async () => {
  const ann = await connect(url);
  ann.send({ type: "create", name: "Ann" });
  const { code } = (await ann.next(m => m.type === "joined")) as { code: string };

  // Ann 10+9, Bob 10+6, dealer 9 up / 8 hole: no peek, no insurance, dealer stands on 17.
  const deck: Card[] = [10, 9, 10, 6, 9, 8, ...Array(200).fill(2)].map((rank, i) => ({ id: `t-${i}`, suit: "hearts", rank, faceUp: true }));
  const room = server.rooms.get(code)!;
  room.table = { ...room.table, deck };

  const bob = await connect(url);
  bob.send({ type: "join", code: code.toLowerCase(), name: "Bob" });
  await bob.next(m => m.type === "joined");

  ann.send({ type: "sit", seat: 0 });
  bob.send({ type: "sit", seat: 1 });
  await ann.state(r => r.table.seats.length === 2);
  ann.send({ type: "bet", amount: 25 });
  bob.send({ type: "bet", amount: 50 });
  await ann.state(r => r.table.phase === "playerTurns");

  bob.send({ type: "action", action: "stand" });
  expect(await bob.next(m => m.type === "error")).toEqual({ type: "error", message: "not your turn" });

  ann.send({ type: "action", action: "stand" });
  await bob.state(r => r.you.actions !== null);
  bob.send({ type: "action", action: "stand" });

  const [annEnd, bobEnd] = await Promise.all([ann.state(r => r.table.phase === "result"), bob.state(r => r.table.phase === "result")]);
  expect(annEnd.table.dealerHand.map(c => c.rank)).toEqual([9, 8]);
  expect(annEnd.table.seats.map(s => s.bankroll)).toEqual([525, 450]);
  expect(bobEnd.table.seats.map(s => s.hands[0].result?.result)).toEqual(["win", "loss"]);

  // Nothing sent before the reveal may carry the shoe or the hole card's identity.
  const beforeReveal = JSON.stringify([...ann.seen, ...bob.seen].filter(m => m.type !== "state" || m.room.table.phase === "playerTurns"));
  expect(beforeReveal).not.toContain('"t-5"');
  expect(beforeReveal).not.toContain('"deck"');

  ann.ws.close();
  bob.ws.close();
});

test("garbage and binary frames get an error reply and the connection stays usable", async () => {
  const c = await connect(url);
  c.send("{not json");
  expect(await c.next(m => m.type === "error")).toEqual({ type: "error", message: "not JSON" });
  c.ws.send(Buffer.from([1, 2, 3]), { binary: true });
  expect(await c.next(m => m.type === "error")).toEqual({ type: "error", message: "text frames only" });
  c.send({ type: "bet", amount: 5 });
  expect(await c.next(m => m.type === "error")).toEqual({ type: "error", message: "create or join a room first" });
  c.send({ type: "join", code: "ABCDEF", name: "x" });
  expect(await c.next(m => m.type === "error")).toEqual({ type: "error", message: "no such room" });
  c.ws.close();
});

test("reconnecting with the token from `joined` re-claims the seat on a fresh socket", async () => {
  const a = await connect(url);
  a.send({ type: "create", name: "Ann" });
  const { code, token } = (await a.next(m => m.type === "joined")) as { code: string; token: string };
  a.send({ type: "sit", seat: 2 });
  await a.state(r => r.you.seat === 2);
  a.ws.close();

  const again = await connect(url);
  again.send({ type: "join", code, name: "Ann", token });
  const snap = await again.state(() => true);
  expect(snap.you).toMatchObject({ seat: 2, isHost: true });
  again.ws.close();
});
