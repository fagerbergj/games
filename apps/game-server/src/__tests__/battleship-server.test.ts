// @vitest-environment node
import type { AddressInfo } from "node:net";
import { FLEET, shipCells, type Coord, type Placement } from "@game-rules/battleship";
import type { BattleshipSnapshot, ClientMessage, PublicBoard } from "@game-rules/battleship/protocol";
import { startGameServer } from "../server";
import { connect as connectAs } from "./ws-client";

const connect = (url: string) => connectAs<BattleshipSnapshot, ClientMessage>(url);

// Ann's ships run along rows 0-4; Bob's run down columns 5-9. Neither fleet covers rows 5-9, cols 0-4.
const ANN: Placement[] = FLEET.map((s, i) => ({ ship: s.id, row: i, col: 0, vertical: false }));
const BOB: Placement[] = FLEET.map((s, i) => ({ ship: s.id, row: 0, col: 5 + i, vertical: true }));
const openWater = (n: number): Coord => ({ row: 5 + Math.floor(n / 5), col: n % 5 });

let server: ReturnType<typeof startGameServer>;
let url: string;

beforeEach(async () => {
  server = startGameServer({ port: 0 });
  await new Promise(resolve => server.wss.once("listening", resolve));
  url = `ws://127.0.0.1:${(server.wss.address() as AddressInfo).port}/ws`;
});
afterEach(() => server.close());

const sunkOnly = (b: PublicBoard) =>
  b.ships.every(p => shipCells(p).every(c => b.shots.some(s => s.hit && s.row === c.row && s.col === c.col)));

test("two players place and play a full game over real sockets without ever seeing an unsunk enemy ship", async () => {
  const ann = await connect(url);
  ann.send({ type: "create", name: "Ann", game: "battleship" });
  const { code } = (await ann.next(m => m.type === "joined")) as { code: string };
  const bob = await connect(url);
  bob.send({ type: "join", code, name: "Bob", game: "battleship" });
  await bob.state(r => r.you.seat === 1);

  ann.send({ type: "place", fleet: ANN });
  await bob.state(r => r.boards[0].ready);
  bob.send({ type: "place", fleet: BOB });
  await ann.state(r => r.phase === "playing");

  // Carrier last, so it only sinks with the winning shot.
  const targets = [...BOB].reverse().flatMap(shipCells);
  for (const [i, target] of targets.entries()) {
    ann.send({ type: "fire", targets: [target] });
    if (i === targets.length - 1) break;
    await bob.state(r => r.turn === 1 && r.boards[1].shots.length === i + 1);
    bob.send({ type: "fire", targets: [openWater(i)] });
    await ann.state(r => r.turn === 0 && r.boards[0].shots.length === i + 1);
  }

  const [annEnd, bobEnd] = await Promise.all([ann.state(r => r.phase === "over"), bob.state(r => r.phase === "over")]);
  expect(annEnd.winner).toBe(0);
  expect(annEnd.boards[1].ships).toEqual(BOB);
  expect(bobEnd.boards[0].ships).toEqual(ANN);

  // Before the end, each side's view of the other's board only ever lists ships it has sunk.
  const live = (c: typeof ann) => c.seen.flatMap(m => (m.type === "state" && m.room.phase !== "over" ? [m.room] : []));
  expect(live(ann).length).toBeGreaterThan(30);
  expect(live(ann).every(r => sunkOnly(r.boards[1]))).toBe(true);
  expect(live(bob).every(r => sunkOnly(r.boards[0]))).toBe(true);
  // The carrier sinks only with the winning shot, so no live frame may name it.
  expect(JSON.stringify(live(ann).map(r => r.boards[1]))).not.toContain('"ship":"carrier"');

  ann.ws.close();
  bob.ws.close();
});

test("joining a room that plays another game is refused", async () => {
  const host = await connect(url);
  host.send({ type: "create", name: "Ann" });
  const { code } = (await host.next(m => m.type === "joined")) as { code: string };
  const guest = await connect(url);
  guest.send({ type: "join", code, name: "Bob", game: "battleship" });
  expect(await guest.next(m => m.type === "error")).toEqual({ type: "error", message: "that room is playing blackjack" });
  host.ws.close();
  guest.ws.close();
});
