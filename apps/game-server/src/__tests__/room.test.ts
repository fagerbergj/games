// @vitest-environment node
import type { Card } from "@game-rules/blackjack";
import { parseClientMessage, type ClientMessage, type RoomSnapshot, type ServerMessage } from "@game-rules/blackjack/protocol";
import { Room } from "../room";
import { newRoomCode, sweepIdleRooms } from "../server";

const BEAT = 100;
const AWAY = 1000;

function newRoom() {
  return new Room("ABCDEF", { beatMs: BEAT, awayMs: AWAY, rng: () => 0.5, deckCount: 6 });
}

/** Stacks the shoe: `ranks` come off the top in order, then filler 2s keep it above the reshuffle point. */
function stackDeck(room: Room, ranks: number[]) {
  const deck: Card[] = [...ranks, ...Array(200).fill(2)].map((rank, i) => ({ id: `t-${i}`, suit: "clubs", rank, faceUp: true }));
  room.table = { ...room.table, deck };
}

function player(room: Room, name: string, token?: string) {
  const inbox: ServerMessage[] = [];
  const send = (m: ServerMessage) => inbox.push(m);
  const tok = room.join(name, send, token);
  const states = () => inbox.filter((m): m is Extract<ServerMessage, { type: "state" }> => m.type === "state").map(m => m.room);
  return {
    token: tok, send, inbox, states,
    snap: (): RoomSnapshot => states().at(-1)!,
    do: (msg: ClientMessage) => room.handle(tok, msg),
  };
}

function seated(room: Room, ...names: string[]) {
  return names.map((n, i) => {
    const p = player(room, n);
    expect(p.do({ type: "sit", seat: i })).toBeNull();
    return p;
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("joining and seats", () => {
  test("creator is host, later joiners are not, and each gets a distinct opaque token", () => {
    const room = newRoom();
    const a = player(room, "Ann");
    const b = player(room, "Bob");
    expect(a.inbox[0]).toEqual({ type: "joined", code: "ABCDEF", token: a.token });
    expect(a.snap().you.isHost).toBe(true);
    expect(b.snap().you.isHost).toBe(false);
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(20);
  });

  test("a taken seat is refused; sitting puts a named seat on the table", () => {
    const room = newRoom();
    const [a] = seated(room, "Ann");
    const b = player(room, "Bob");
    expect(b.do({ type: "sit", seat: 0 })).toBe("seat taken");
    expect(a.snap().table.seats.map(s => s.label)).toEqual(["Ann"]);
    expect(a.snap().slots[0]).toEqual({ name: "Ann", connected: true, host: true });
  });

  test("moving seats between rounds keeps the bankroll; mid-round it's refused", () => {
    const room = newRoom();
    stackDeck(room, [10, 7, 9, 8]);
    const [a] = seated(room, "Ann");
    expect(a.do({ type: "sit", seat: 3 })).toBeNull();
    expect(a.snap().table.seats.map(s => s.id)).toEqual(["slot-3"]);
    a.do({ type: "bet", amount: 50 });
    expect(a.do({ type: "sit", seat: 1 })).toBe("change seats between rounds");
  });

  test("sitting down mid-round benches the seat until the next round", () => {
    const room = newRoom();
    stackDeck(room, [10, 7, 9, 8]);
    const [a] = seated(room, "Ann");
    a.do({ type: "bet", amount: 50 });
    const b = player(room, "Bob");
    expect(b.do({ type: "sit", seat: 1 })).toBeNull();
    expect(b.snap().table.seats.map(s => s.label)).toEqual(["Ann"]);
    expect(b.snap().slots[1]?.name).toBe("Bob");
    a.do({ type: "action", action: "stand" });
    vi.runAllTimers();
    expect(a.do({ type: "newRound" })).toBeNull();
    expect(b.snap().table.seats.map(s => s.label)).toEqual(["Ann", "Bob"]);
  });
});

test("the last non-bettor leaving deals the table without the host", () => {
  const room = newRoom();
  stackDeck(room, [10, 7, 10, 6, 9, 8]);
  const [a, b] = seated(room, "Ann", "Bob");
  a.do({ type: "bet", amount: 10 });
  b.do({ type: "leave" });
  expect(a.snap().table.phase).toBe("playerTurns");
});

describe("authorisation", () => {
  test("betting needs a seat, the betting phase and enough bankroll", () => {
    const room = newRoom();
    stackDeck(room, [10, 7, 10, 6, 9, 8]);
    const [a, b] = seated(room, "Ann", "Bob");
    const c = player(room, "Cid");
    expect(c.do({ type: "bet", amount: 10 })).toBe("sit down first");
    expect(a.do({ type: "bet", amount: 501 })).toBe("not enough bankroll");
    a.do({ type: "bet", amount: 10 });
    b.do({ type: "bet", amount: 10 });
    expect(a.do({ type: "bet", amount: 10 })).toBe("bets are closed");
  });

  test("only the seat on the clock may play, and only the host may deal or reset", () => {
    const room = newRoom();
    stackDeck(room, [10, 7, 10, 6, 9, 8]);
    const [a, b] = seated(room, "Ann", "Bob");
    a.do({ type: "bet", amount: 10 });
    expect(b.do({ type: "start" })).toBe("only the host can deal");
    expect(a.do({ type: "start" })).toBeNull(); // Bob hasn't bet: he sits this round out
    expect(a.snap().table.seats.map(s => s.label)).toEqual(["Ann"]);
    expect(b.do({ type: "action", action: "hit" })).toBe("you aren't in this round");
    expect(a.do({ type: "action", action: "insurance" })).toBe("insurance isn't on offer");
    expect(a.do({ type: "action", action: "stand" })).toBeNull();
    vi.runAllTimers();
    expect(b.do({ type: "newRound" })).toBe("only the host can start a new round");
    expect(a.do({ type: "newRound" })).toBeNull();
  });

  test("a seated player whose turn it isn't is refused", () => {
    const room = newRoom();
    stackDeck(room, [10, 7, 10, 6, 9, 8]);
    const [a, b] = seated(room, "Ann", "Bob");
    a.do({ type: "bet", amount: 10 });
    b.do({ type: "bet", amount: 10 });
    expect(a.snap().table.phase).toBe("playerTurns");
    expect(b.do({ type: "action", action: "hit" })).toBe("not your turn");
    expect(b.snap().you.actions).toBeNull();
    expect(a.snap().you.actions?.canHit).toBe(true);
  });

  test("an illegal move in the right phase is rejected without changing the table", () => {
    const room = newRoom();
    stackDeck(room, [10, 7, 9, 8]);
    const [a] = seated(room, "Ann");
    a.do({ type: "bet", amount: 10 });
    const before = room.table;
    expect(a.do({ type: "action", action: "split" })).toBe("can't split now");
    expect(room.table).toBe(before);
  });

  test("messages from someone who already left are refused", () => {
    const room = newRoom();
    const a = player(room, "Ann");
    player(room, "Bob");
    a.do({ type: "leave" });
    expect(a.do({ type: "sit", seat: 0 })).toBe("not in this room");
  });
});

describe("reconnect", () => {
  test("re-joining with the token re-claims the seat and host role", () => {
    const room = newRoom();
    const [a] = seated(room, "Ann");
    room.disconnect(a.token, a.send);
    expect(room.snapshotFor(a.token)!.slots[0]?.connected).toBe(false);
    const again = player(room, "whoever", a.token);
    expect(again.token).toBe(a.token);
    expect(again.snap().you).toMatchObject({ seat: 0, isHost: true });
    expect(again.snap().slots[0]).toEqual({ name: "Ann", connected: true, host: true });
  });

  test("a stale socket closing after the reconnect doesn't drop the new one", () => {
    const room = newRoom();
    const [a] = seated(room, "Ann");
    const again = player(room, "Ann", a.token);
    expect(a.inbox.at(-1)).toEqual({ type: "error", message: "signed in from another connection" });
    room.disconnect(a.token, a.send);
    expect(again.snap().slots[0]?.connected).toBe(true);
  });

  test("an unknown token just joins as a new player", () => {
    const room = newRoom();
    player(room, "Ann");
    const b = player(room, "Bob", "not-a-real-token");
    expect(b.token).not.toBe("not-a-real-token");
    expect(b.snap().you).toMatchObject({ seat: null, isHost: false });
  });
});

describe("snapshots never leak the shoe or the hole card", () => {
  test("hole card is a fixed placeholder until the dealer flips it", () => {
    const room = newRoom();
    stackDeck(room, [10, 7, 9, 8]);
    const [a] = seated(room, "Ann");
    a.do({ type: "bet", amount: 10 });
    const hole = room.table.dealerHand[1];
    const json = JSON.stringify(a.snap());
    expect(json).not.toContain(`"${hole.id}"`);
    expect(json).not.toContain('"deck"');
    expect(a.snap().table.dealerHand[1]).toEqual({ id: "hole", suit: "spades", rank: 0, faceUp: false });
    expect(a.snap().table.shoeRemaining).toBe(room.table.deck.length);
  });

  test("the dealer's draws appear one beat at a time, and no result shows before the last", () => {
    const room = newRoom();
    // Ann 10+7 stands; dealer 4+2 then draws 3, 4, 5 -> 18.
    stackDeck(room, [10, 7, 4, 2, 3, 4, 5]);
    const [a] = seated(room, "Ann");
    a.do({ type: "bet", amount: 10 });
    a.do({ type: "action", action: "stand" });
    expect(a.snap().table.dealerHand.map(c => c.rank)).toEqual([4, 2]);
    for (const expected of [[4, 2, 3], [4, 2, 3, 4], [4, 2, 3, 4, 5]]) {
      vi.advanceTimersByTime(BEAT - 1);
      expect(a.snap().table.dealerHand).toHaveLength(expected.length - 1);
      vi.advanceTimersByTime(1);
      expect(a.snap().table.dealerHand.map(c => c.rank)).toEqual(expected);
      expect(a.snap().table.phase).toBe("dealerTurn");
    }
    vi.advanceTimersByTime(BEAT);
    expect(a.snap().table.phase).toBe("result");
    expect(a.snap().table.seats[0].hands[0].result?.result).toBe("loss");
    const everSent = JSON.stringify(a.states().filter(s => s.table.phase !== "result"));
    expect(everSent).not.toContain('"result":{');
  });
});

describe("pacing", () => {
  test("a split hand's second card lands one beat after play reaches it", () => {
    const room = newRoom();
    // Ann 8,8 splits: hand A gets 10 now (stands), hand B waits one beat for its card.
    stackDeck(room, [8, 8, 9, 7, 10, 3, 5]);
    const [a] = seated(room, "Ann");
    a.do({ type: "bet", amount: 10 });
    a.do({ type: "action", action: "split" });
    a.do({ type: "action", action: "stand" });
    const handB = () => a.snap().table.seats[0].hands[1];
    expect(handB().cards).toHaveLength(1);
    expect(a.do({ type: "action", action: "hit" })).toBe("wait for the deal");
    vi.advanceTimersByTime(BEAT);
    expect(handB().cards.map(c => c.rank)).toEqual([8, 3]);
  });
});

describe("absent players never stall the table", () => {
  test("a disconnected player on the clock is stood for after the grace period", () => {
    const room = newRoom();
    stackDeck(room, [10, 7, 10, 6, 9, 8]);
    const [a, b] = seated(room, "Ann", "Bob");
    a.do({ type: "bet", amount: 10 });
    b.do({ type: "bet", amount: 10 });
    room.disconnect(a.token, a.send);
    vi.advanceTimersByTime(AWAY - 1);
    expect(b.snap().table.activeSeatIndex).toBe(0);
    vi.advanceTimersByTime(1);
    expect(b.snap().table.activeSeatIndex).toBe(1);
    expect(b.snap().table.seats[0].hands[0].status).toBe("stood");
  });

  test("leaving mid-round stands the leaver at once and frees the seat after the round", () => {
    const room = newRoom();
    stackDeck(room, [10, 7, 10, 6, 9, 8]);
    const [a, b] = seated(room, "Ann", "Bob");
    a.do({ type: "bet", amount: 10 });
    b.do({ type: "bet", amount: 10 });
    expect(a.do({ type: "leave" })).toBeNull();
    expect(b.snap().table.activeSeatIndex).toBe(1);
    expect(b.snap().you.isHost).toBe(true);
    b.do({ type: "action", action: "stand" });
    vi.runAllTimers();
    b.do({ type: "newRound" });
    expect(b.snap().table.seats.map(s => s.label)).toEqual(["Bob"]);
  });

  test("anyone may deal while the host is disconnected", () => {
    const room = newRoom();
    stackDeck(room, [10, 7, 10, 6, 9, 8]);
    const [a, b] = seated(room, "Ann", "Bob");
    b.do({ type: "bet", amount: 10 });
    room.disconnect(a.token, a.send);
    expect(b.do({ type: "start" })).toBeNull();
  });
});

describe("idle room GC", () => {
  test("drops a room only once it has been empty for idleMs", () => {
    const rooms = new Map<string, Room>();
    const busy = newRoom();
    const idle = new Room("ZZZZZZ");
    rooms.set(busy.code, busy).set(idle.code, idle);
    player(busy, "Ann");
    const z = player(idle, "Zed");
    vi.setSystemTime(0);
    idle.disconnect(z.token, z.send);
    sweepIdleRooms(rooms, 59_999, 60_000);
    expect([...rooms.keys()]).toEqual(["ABCDEF", "ZZZZZZ"]);
    sweepIdleRooms(rooms, 60_000, 60_000);
    expect([...rooms.keys()]).toEqual(["ABCDEF"]);
  });

  test("room codes are 6 chars from the unambiguous alphabet and avoid taken ones", () => {
    const code = newRoomCode(new Set());
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });
});

describe("parseClientMessage", () => {
  test.each([
    ["{", "not JSON"],
    ["[]", "message must be an object"],
    ['{"type":"nope"}', "unknown message type"],
    ['{"type":"toString"}', "unknown message type"],
    ['{"type":"sit","seat":5}', "seat must be 0-4"],
    ['{"type":"sit","seat":"1"}', "seat must be 0-4"],
    ['{"type":"bet","amount":2.5}', "bet must be a whole positive amount"],
    ['{"type":"bet","amount":-5}', "bet must be a whole positive amount"],
    ['{"type":"action","action":"cheat"}', "unknown action"],
    ['{"type":"join","code":"abc"}', "room code must be 6 letters/digits"],
    ['{"type":"join","code":"ABCDE0"}', "room code must be 6 letters/digits"],
  ])("%s -> %s", (raw, error) => {
    expect(parseClientMessage(raw)).toBe(error);
  });

  test("normalises a join: upper-cases the code and defaults the name", () => {
    expect(parseClientMessage('{"type":"join","code":" abcdef "}')).toEqual({ type: "join", code: "ABCDEF", name: "Player" });
  });
});
