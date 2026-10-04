// @vitest-environment node
import { FLEET, shipCells, type Coord, type Placement } from "@game-rules/battleship";
import type { BattleshipSnapshot, ClientMessage, ServerMessage } from "@game-rules/battleship/protocol";
import type { Fields } from "@game-rules/protocol";
import { BattleshipRoom } from "../games/battleship";

const TURN = 5000;
const AWAY = 1000;

// Ships stacked in rows 0-4 from column 0: carrier row 0 ... destroyer row 4.
const ROWS: Placement[] = FLEET.map((s, i) => ({ ship: s.id, row: i, col: 0, vertical: false }));
// Same ships, stacked down columns 5-9 from row 0.
const COLS: Placement[] = FLEET.map((s, i) => ({ ship: s.id, row: 0, col: 5 + i, vertical: true }));
const MISS: Coord = { row: 9, col: 0 };
/** The nth cell of rows 5-9, where ROWS has no ships. */
const openWater = (n: number): Coord => ({ row: 5 + Math.floor(n / 10), col: n % 10 });

function newRoom() {
  let i = 0;
  return new BattleshipRoom("ABCDEF", { turnMs: TURN, awayMs: AWAY, rng: () => (i++ * 0.37) % 1 });
}

function player(room: BattleshipRoom, name: string) {
  const inbox: ServerMessage[] = [];
  const send = (m: ServerMessage) => inbox.push(m);
  const token = room.join(name, send);
  const states = () => inbox.flatMap(m => (m.type === "state" ? [m.room] : []));
  return {
    token, send, inbox, states,
    snap: (): BattleshipSnapshot => states().at(-1)!,
    do: (msg: ClientMessage) => room.handle(token, msg, send),
    raw: (frame: Fields) => room.receive(token, frame, send),
  };
}

/** Ann (seat 0, ROWS) and Bob (seat 1, COLS) with both fleets placed; Ann to fire. */
function playing(room = newRoom()) {
  const a = player(room, "Ann");
  const b = player(room, "Bob");
  expect(a.do({ type: "place", fleet: ROWS })).toBeNull();
  expect(b.do({ type: "place", fleet: COLS })).toBeNull();
  return [a, b] as const;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("seats", () => {
  test("the first two players take seats 0 and 1; a third watches and can't act", () => {
    const room = newRoom();
    const [a, b] = [player(room, "Ann"), player(room, "Bob")];
    const c = player(room, "Cid");
    expect([a.snap().you.seat, b.snap().you.seat, c.snap().you.seat]).toEqual([0, 1, null]);
    expect(a.snap().players.map(p => p?.name)).toEqual(["Ann", "Bob"]);
    expect(c.do({ type: "place", fleet: ROWS })).toBe("you're watching this game");
  });

  test("a watcher takes a seat freed during placement, onto a fresh board", () => {
    const room = newRoom();
    const a = player(room, "Ann");
    const b = player(room, "Bob");
    const c = player(room, "Cid");
    b.do({ type: "place", fleet: COLS });
    b.do({ type: "leave" });
    expect(c.snap().you.seat).toBe(1);
    expect(a.snap().boards[1]).toEqual({ ready: false, shots: [], ships: [] });
  });
});

describe("placement and ready-up", () => {
  test("placing readies you; play starts with seat 0 once both are ready", () => {
    const room = newRoom();
    const a = player(room, "Ann");
    const b = player(room, "Bob");
    a.do({ type: "place", fleet: ROWS });
    expect(b.snap().boards[0].ready).toBe(true);
    expect(b.snap().phase).toBe("placing");
    b.do({ type: "place", fleet: COLS });
    expect(a.snap()).toMatchObject({ phase: "playing", turn: 0, shotsAllowed: 1, turnMsLeft: TURN });
  });

  test("malformed and illegal fleets are refused with a reason", () => {
    const room = newRoom();
    const a = player(room, "Ann");
    expect(a.raw({ type: "place", fleet: ROWS.slice(1) })).toBe("fleet must list each ship once");
    expect(a.raw({ type: "place", fleet: [...ROWS.slice(0, 4), { ship: "destroyer", row: 3, col: 1, vertical: true }] }))
      .toBe("destroyer overlaps another ship");
    expect(a.raw({ type: "place", fleet: [{ ...ROWS[0], row: "0" }, ...ROWS.slice(1)] })).toBe("fleet must list each ship once");
  });

  test("only the host may switch on salvo, and only before anyone has placed", () => {
    const room = newRoom();
    const a = player(room, "Ann");
    const b = player(room, "Bob");
    expect(b.do({ type: "salvo", on: true })).toBe("only the host can change the rules");
    expect(a.do({ type: "salvo", on: true })).toBeNull();
    expect(b.snap().salvo).toBe(true);
    a.do({ type: "place", fleet: ROWS });
    expect(a.do({ type: "salvo", on: false })).toBe("rules are fixed once a fleet is placed");
    b.do({ type: "place", fleet: COLS });
    expect(a.snap().shotsAllowed).toBe(5);
  });
});

describe("turns", () => {
  test("only the player on turn may fire; the shot lands and the turn passes", () => {
    const [a, b] = playing();
    expect(b.do({ type: "fire", targets: [MISS] })).toBe("not your turn");
    expect(a.do({ type: "fire", targets: [{ row: 0, col: 5 }] })).toBeNull();
    expect(b.snap().boards[1].shots).toEqual([{ row: 0, col: 5, hit: true }]);
    expect(b.snap().turn).toBe(1);
  });

  test("the turn clock passes a turn nobody takes, and restarts for the next", () => {
    const [a, b] = playing();
    vi.advanceTimersByTime(TURN - 1);
    expect(b.snap().turn).toBe(0);
    vi.advanceTimersByTime(1);
    expect(b.snap()).toMatchObject({ turn: 1, turnMsLeft: TURN });
    expect(a.snap().boards[1].shots).toEqual([]);
    vi.advanceTimersByTime(TURN / 2);
    b.do({ type: "fire", targets: [MISS] });
    expect(a.snap()).toMatchObject({ turn: 0, turnMsLeft: TURN });
  });

  test("a disconnected player's turns pass at once after the grace period", () => {
    const r = newRoom();
    const [a, b] = playing(r);
    a.do({ type: "fire", targets: [MISS] });
    r.disconnect(b.token, b.send);
    vi.advanceTimersByTime(AWAY - 1);
    expect(a.snap().turn).toBe(1);
    vi.advanceTimersByTime(1);
    expect(a.snap().turn).toBe(0);
    a.do({ type: "fire", targets: [{ row: 9, col: 1 }] });
    expect(a.snap().turn).toBe(0);
  });

  test("a player who goes away mid-placement gets a random legal fleet", () => {
    const r = newRoom();
    const a = player(r, "Ann");
    const b = player(r, "Bob");
    a.do({ type: "place", fleet: ROWS });
    r.disconnect(b.token, b.send);
    vi.advanceTimersByTime(AWAY);
    expect(a.snap().phase).toBe("playing");
    expect(r.state.boards[1].fleet).toHaveLength(5);
  });

  test("when both players are away nothing auto-plays", () => {
    const r = newRoom();
    const [a, b] = playing(r);
    r.disconnect(a.token, a.send);
    r.disconnect(b.token, b.send);
    vi.advanceTimersByTime(AWAY + TURN);
    expect(r.state.turn).toBe(0);
    r.join("Ann", a.send, a.token);
    expect(a.snap()).toMatchObject({ turn: 0, turnMsLeft: null });
    r.join("Bob", b.send, b.token);
    expect(a.snap()).toMatchObject({ turn: 0, turnMsLeft: TURN });
  });

  test("leaving mid-game concedes it", () => {
    const [a, b] = playing();
    expect(b.do({ type: "leave" })).toBeNull();
    expect(a.snap()).toMatchObject({ phase: "over", winner: 0, turnMsLeft: null });
  });

  test("sinking the last ship wins; then either player can start a rematch with the same rules", () => {
    const [a, b] = playing();
    for (const target of COLS.flatMap(shipCells)) {
      a.do({ type: "fire", targets: [target] });
      if (a.snap().phase === "over") break;
      b.do({ type: "fire", targets: [openWater(b.snap().boards[0].shots.length)] });
    }
    expect(a.snap()).toMatchObject({ phase: "over", winner: 0 });
    expect(b.do({ type: "rematch" })).toBeNull();
    expect(a.snap()).toMatchObject({ phase: "placing", winner: null, salvo: false });
    expect(a.snap().boards[0]).toEqual({ ready: false, shots: [], ships: [] });
  });
});

describe("hidden information", () => {
  // Every ship in `board.ships` must be one whose every cell has been hit.
  const allSunk = (board: BattleshipSnapshot["boards"][number]) =>
    board.ships.every(p => shipCells(p).every(c => board.shots.some(s => s.hit && s.row === c.row && s.col === c.col)));

  test("an opponent's placed fleet is never sent while placing", () => {
    const room = newRoom();
    const a = player(room, "Ann");
    const b = player(room, "Bob");
    b.do({ type: "place", fleet: COLS });
    expect(a.snap().boards[1]).toEqual({ ready: true, shots: [], ships: [] });
    expect(b.snap().boards[1].ships).toEqual(COLS);
  });

  test("an opponent's ship appears only once sunk, and the whole fleet only at game end", () => {
    const [a, b] = playing();
    const destroyer = COLS[4];
    a.do({ type: "fire", targets: [{ row: 0, col: 9 }] });
    expect(a.snap().boards[1].ships).toEqual([]);
    expect(a.snap().boards[1].shots).toEqual([{ row: 0, col: 9, hit: true }]);
    b.do({ type: "fire", targets: [MISS] });
    a.do({ type: "fire", targets: [{ row: 1, col: 9 }] });
    expect(a.snap().boards[1].ships).toEqual([destroyer]);
    // Bob's own board still shows Bob his whole fleet; Ann's is still hidden from him.
    expect(b.snap().boards[1].ships).toEqual(COLS);
    expect(b.snap().boards[0].ships).toEqual([]);
    b.do({ type: "leave" });
    expect(a.snap().boards[1].ships).toEqual(COLS);
  });

  test("a watcher sees neither fleet until ships sink", () => {
    const room = newRoom();
    const [a] = playing(room);
    const c = player(room, "Cid");
    a.do({ type: "fire", targets: [{ row: 0, col: 9 }] });
    expect(c.snap().boards.map(b => b.ships)).toEqual([[], []]);
  });

  test("no frame sent before the end ever carries an unsunk enemy ship", () => {
    const [a, b] = playing();
    for (const target of COLS.flatMap(shipCells)) {
      a.do({ type: "fire", targets: [target] });
      if (a.snap().phase === "over") break;
      b.do({ type: "fire", targets: [openWater(b.snap().boards[0].shots.length)] });
    }
    const live = (p: typeof a) => p.states().filter(s => s.phase !== "over");
    expect(live(a).length).toBeGreaterThan(20);
    expect(live(a).every(s => allSunk(s.boards[1]))).toBe(true);
    expect(live(b).every(s => allSunk(s.boards[0]))).toBe(true);
  });
});

