// @vitest-environment node
import type { AddressInfo } from "node:net";
import type { Card } from "@game-rules/blackjack";
import type { ClientMessage, RoomSnapshot } from "@game-rules/blackjack/protocol";
import type { BlackjackRoom } from "../games/blackjack";
import { startGameServer } from "../server";
import { connect as connectAs } from "./ws-client";

type Server = ReturnType<typeof startGameServer>;

const connect = (url: string) => connectAs<RoomSnapshot, ClientMessage>(url);

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
  const room = server.rooms.get(code) as BlackjackRoom;
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

test("an oversized frame closes only that socket; the server keeps serving", async () => {
  const big = await connect(url);
  const closed = new Promise<number>(resolve => big.ws.once("close", code => resolve(code)));
  big.send("x".repeat(5000));
  expect(await closed).toBe(1009);

  const other = await connect(url);
  other.send({ type: "create", name: "Ann" });
  expect((await other.next(m => m.type === "joined")).type).toBe("joined");
  other.ws.close();
});
