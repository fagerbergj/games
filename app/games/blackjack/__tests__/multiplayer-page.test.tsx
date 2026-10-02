import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { createSeat, startRound, placeBet, getActiveHandActions, DEFAULT_HOUSE_RULES, type BlackjackTableState, type Card } from "@game-rules/blackjack";
import { publicTable, type RoomSnapshot, type ServerMessage } from "@game-rules/blackjack/protocol";
import MultiplayerBlackjackPage from "../multiplayer/page";

class FakeSocket {
  static OPEN = 1;
  static last: FakeSocket;
  static count = 0;
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.last = this;
    FakeSocket.count++;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    act(() => this.onopen?.());
  }
  /** The server going away mid-session. */
  drop() {
    this.readyState = 3;
    act(() => this.onclose?.());
  }
  push(m: ServerMessage) {
    act(() => this.onmessage?.({ data: JSON.stringify(m) }));
  }
}

const deck = (ranks: number[]): Card[] => ranks.map((rank, i) => ({ id: `t-${i}`, suit: "spades", rank, faceUp: true }));

function table(): BlackjackTableState {
  return {
    seats: [createSeat("slot-0", "Ann", 500), createSeat("slot-1", "Bob", 500)],
    activeSeatIndex: 0, dealerHand: [], deck: deck([10, 7, 10, 6, 9, 8, ...Array(100).fill(2)]),
    phase: "betting", houseRules: DEFAULT_HOUSE_RULES,
  };
}

function snapshot(state: BlackjackTableState, you: RoomSnapshot["you"]): RoomSnapshot {
  return {
    code: "K7QX2M", you,
    slots: [{ name: "Ann", connected: true, host: true }, { name: "Bob", connected: true, host: false }, null, null, null],
    table: publicTable(state), count: { running: 0, justReshuffled: false },
  };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => vi.unstubAllGlobals());

function createRoomAsAnn() {
  render(<MultiplayerBlackjackPage />);
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ann" } });
  fireEvent.click(screen.getByRole("button", { name: "Create room" }));
  const ws = FakeSocket.last;
  ws.open();
  expect(ws.sent).toEqual([{ type: "create", name: "Ann" }]);
  ws.push({ type: "joined", code: "K7QX2M", token: "tok" });
  return ws;
}

test("lobby creates a room, shows its code, and only your own seat gets betting controls", () => {
  const ws = createRoomAsAnn();
  ws.push({ type: "state", room: snapshot(table(), { seat: 0, isHost: true, canDirect: true, actions: null }) });

  expect(screen.getByTestId("room-code")).toHaveTextContent("K7QX2M");
  expect(screen.getByText("(you, host)")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /Sit in seat/ })).toHaveLength(3);
  expect(screen.getAllByRole("button", { name: "Add $5 chip" })).toHaveLength(1);
  expect(screen.getByText("Choosing a bet…")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Add $25 chip" }));
  fireEvent.click(screen.getByRole("button", { name: "Place bet of $25" }));
  expect(ws.sent.at(-1)).toEqual({ type: "bet", amount: 25 });
  expect(JSON.parse(sessionStorage.getItem("blackjack_mp_session")!)).toEqual({ code: "K7QX2M", token: "tok", name: "Ann" });
});

test("on your turn the action buttons send moves, and the hole card renders face down", () => {
  const ws = createRoomAsAnn();
  const dealt = startRound(placeBet(placeBet(table(), 0, 25), 1, 50), 6, Math.random);
  ws.push({ type: "state", room: snapshot(dealt, { seat: 0, isHost: true, canDirect: true, actions: getActiveHandActions(dealt) }) });

  expect(within(screen.getByTestId("dealer-zone")).getAllByTestId("card-back")).toHaveLength(1);
  expect(screen.getByText("9 + ?")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Stand" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Stand" }));
  expect(ws.sent.at(-1)).toEqual({ type: "action", action: "stand" });
});

test("a server error in the lobby is shown and the stored session is dropped", () => {
  sessionStorage.setItem("blackjack_mp_session", JSON.stringify({ code: "K7QX2M", token: "old", name: "Ann" }));
  render(<MultiplayerBlackjackPage />);
  const ws = FakeSocket.last;
  ws.open();
  expect(ws.sent).toEqual([{ type: "join", code: "K7QX2M", name: "Ann", token: "old" }]);
  ws.push({ type: "error", message: "no such room" });
  expect(screen.getByRole("alert")).toHaveTextContent("no such room");
  expect(sessionStorage.getItem("blackjack_mp_session")).toBeNull();
});

test("Deal stays disabled until someone has bet, then sends start", () => {
  const ws = createRoomAsAnn();
  const you = { seat: 0, isHost: true, canDirect: true, actions: null };
  ws.push({ type: "state", room: snapshot(table(), you) });
  expect(screen.getByRole("button", { name: "Deal" })).toBeDisabled();

  ws.push({ type: "state", room: snapshot(placeBet(table(), 0, 25), you) });
  fireEvent.click(screen.getByRole("button", { name: "Deal" }));
  expect(ws.sent.at(-1)).toEqual({ type: "start" });
});

test("New Round sends newRound once the round is over", () => {
  const ws = createRoomAsAnn();
  ws.push({ type: "state", room: snapshot({ ...table(), phase: "result" }, { seat: 0, isHost: true, canDirect: true, actions: null }) });
  fireEvent.click(screen.getByRole("button", { name: "New Round" }));
  expect(ws.sent.at(-1)).toEqual({ type: "newRound" });
});

test("a non-host gets the table controls only while the host is away", () => {
  const ws = createRoomAsAnn();
  const bob = { seat: 1, isHost: false, actions: null };
  ws.push({ type: "state", room: snapshot(placeBet(table(), 1, 25), { ...bob, canDirect: false }) });
  expect(screen.queryByRole("button", { name: "Deal" })).toBeNull();
  ws.push({ type: "state", room: snapshot(placeBet(table(), 1, 25), { ...bob, canDirect: true }) });
  fireEvent.click(screen.getByRole("button", { name: "Deal" }));
  expect(ws.sent.at(-1)).toEqual({ type: "start" });
});

test("Leave clears a showing error and returns to the lobby", () => {
  const ws = createRoomAsAnn();
  ws.push({ type: "state", room: snapshot(table(), { seat: 0, isHost: true, canDirect: true, actions: null }) });
  ws.push({ type: "error", message: "signed in from another connection" });
  expect(screen.getByRole("alert")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Leave" }));
  expect(ws.sent.at(-1)).toEqual({ type: "leave" });
  expect(screen.getByRole("button", { name: "Create room" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
});

describe("reconnecting", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("a send made while the socket is down is queued and goes out after the rejoin", () => {
    const ws = createRoomAsAnn();
    ws.push({ type: "state", room: snapshot(table(), { seat: 0, isHost: true, canDirect: true, actions: null }) });
    ws.drop();
    fireEvent.click(screen.getByRole("button", { name: "Add $25 chip" }));
    fireEvent.click(screen.getByRole("button", { name: "Place bet of $25" }));
    act(() => vi.advanceTimersByTime(1000));

    const again = FakeSocket.last;
    expect(again).not.toBe(ws);
    again.open();
    expect(again.sent).toEqual([{ type: "join", code: "K7QX2M", name: "Ann", token: "tok" }]);
    again.push({ type: "joined", code: "K7QX2M", token: "tok" });
    expect(again.sent.at(-1)).toEqual({ type: "bet", amount: 25 });
  });

  test("a rejoin that never connects gives up with an error but keeps the session for a refresh", () => {
    const session = JSON.stringify({ code: "K7QX2M", token: "old", name: "Ann" });
    sessionStorage.setItem("blackjack_mp_session", session);
    render(<MultiplayerBlackjackPage />);
    const start = FakeSocket.count;
    for (let i = 0; i < 7; i++) {
      expect(screen.queryByRole("alert")).toBeNull();
      FakeSocket.last.drop();
      act(() => vi.advanceTimersByTime(8000));
    }
    expect(FakeSocket.count - start).toBe(6);
    expect(screen.getByRole("alert")).toHaveTextContent("Can't reach the game server");
    expect(sessionStorage.getItem("blackjack_mp_session")).toBe(session);
  });
});
