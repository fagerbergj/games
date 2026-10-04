import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { FLEET, createGame, fire, placeFleet, placementError, type BattleshipState, type Placement, type Seat } from "@game-rules/battleship";
import { publicBoards, turnShots, type BattleshipSnapshot, type ServerMessage } from "@game-rules/battleship/protocol";
import BattleshipPage from "../page";

class FakeSocket {
  static OPEN = 1;
  static last: FakeSocket;
  readyState = 0;
  sent: { type: string; [k: string]: unknown }[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.last = this;
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
  push(m: ServerMessage) {
    act(() => this.onmessage?.({ data: JSON.stringify(m) }));
  }
}

const ROWS: Placement[] = FLEET.map((s, i) => ({ ship: s.id, row: i, col: 0, vertical: false }));
const COLS: Placement[] = FLEET.map((s, i) => ({ ship: s.id, row: 0, col: 5 + i, vertical: true }));

function ok(s: BattleshipState | string): BattleshipState {
  if (typeof s === "string") throw new Error(s);
  return s;
}

const playing = (salvo = false) => ok(placeFleet(ok(placeFleet(createGame({ salvo }), 0, ROWS)), 1, COLS));

function snapshot(state: BattleshipState, seat: Seat | null = 0, extra: Partial<BattleshipSnapshot> = {}): BattleshipSnapshot {
  return {
    code: "K7QX2M", you: { seat, isHost: seat === 0 },
    players: [{ name: "Ann", connected: true, host: true }, { name: "Bob", connected: true, host: false }],
    phase: state.phase, salvo: state.salvo, turn: state.turn, winner: state.winner,
    shotsAllowed: turnShots(state), turnMsLeft: state.phase === "playing" ? 60_000 : null,
    boards: publicBoards(state, seat), ...extra,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => vi.unstubAllGlobals());

function enter(state: BattleshipState, seat: Seat | null = 0) {
  render(<BattleshipPage />);
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ann" } });
  fireEvent.click(screen.getByRole("button", { name: "Create room" }));
  const ws = FakeSocket.last;
  ws.open();
  expect(ws.sent).toEqual([{ type: "create", name: "Ann", game: "battleship" }]);
  ws.push({ type: "joined", code: "K7QX2M", token: "tok" });
  ws.push({ type: "state", room: snapshot(state, seat) });
  return ws;
}

const cell = (grid: string, name: string) => within(screen.getByRole("grid", { name: grid })).getByRole("button", { name: new RegExp(`^${name},`) });

describe("placement", () => {
  test("shows the room code, a labelled 10x10 board and the host's salvo switch", () => {
    const ws = enter(createGame());
    expect(screen.getByTestId("room-code")).toHaveTextContent("K7QX2M");
    expect(within(screen.getByRole("grid", { name: "Your fleet: placement" })).getAllByRole("button")).toHaveLength(100);
    fireEvent.click(screen.getByRole("checkbox", { name: /Salvo/ }));
    expect(ws.sent.at(-1)).toEqual({ type: "salvo", on: true });
  });

  test("click a ship then a cell to place it, R to rotate, and Ready stays off until the fleet is complete", () => {
    enter(createGame());
    const ready = screen.getByRole("button", { name: "Ready" });
    fireEvent.click(screen.getByRole("button", { name: /destroyer/ }));
    fireEvent.keyDown(cell("Your fleet: placement", "A1"), { key: "r" });
    expect(screen.getByRole("button", { name: /Rotate \(vertical\)/ })).toBeInTheDocument();
    fireEvent.click(cell("Your fleet: placement", "C3"));
    expect(cell("Your fleet: placement", "C4")).toHaveAccessibleName("C4, destroyer");
    expect(ready).toBeDisabled();
  });

  test("a ship that would run off the board isn't placed", () => {
    enter(createGame());
    fireEvent.mouseEnter(cell("Your fleet: placement", "H1")); // carrier would need H1-L1
    expect(cell("Your fleet: placement", "H1")).toHaveAccessibleName("H1, doesn't fit");
    fireEvent.click(cell("Your fleet: placement", "H1"));
    fireEvent.mouseLeave(screen.getByRole("grid", { name: "Your fleet: placement" }));
    expect(cell("Your fleet: placement", "H1")).toHaveAccessibleName("H1, water");
  });

  test("Random then Ready sends a legal fleet", () => {
    const ws = enter(createGame());
    fireEvent.click(screen.getByRole("button", { name: "Random" }));
    fireEvent.click(screen.getByRole("button", { name: "Ready" }));
    const sent = ws.sent.at(-1)!;
    expect(sent.type).toBe("place");
    expect(placementError(sent.fleet as Placement[])).toBeNull();
  });

  test("clicking a placed ship, or its done button, picks it up in its own orientation", () => {
    enter(createGame());
    const grid = "Your fleet: placement";
    const ships = screen.getByRole("list", { name: "Ships" });
    fireEvent.click(within(ships).getByRole("button", { name: /destroyer/ }));
    fireEvent.keyDown(cell(grid, "A1"), { key: "r" });
    fireEvent.click(cell(grid, "A1")); // vertical destroyer on A1+A2
    expect(cell(grid, "A2")).toHaveAccessibleName("A2, destroyer");
    fireEvent.keyDown(cell(grid, "A1"), { key: "r" }); // back to horizontal
    fireEvent.click(cell(grid, "A1"));
    expect(cell(grid, "A1")).toHaveAccessibleName("A1, water");
    expect(cell(grid, "A2")).toHaveAccessibleName("A2, water");
    fireEvent.click(cell(grid, "D4")); // picking up restored vertical
    expect(cell(grid, "D5")).toHaveAccessibleName("D5, destroyer");
    expect(cell(grid, "E4")).toHaveAccessibleName("E4, water");
    fireEvent.click(within(ships).getByRole("button", { name: /destroyer/ }));
    expect(cell(grid, "D4")).toHaveAccessibleName("D4, water");
    expect(within(ships).getByRole("button", { name: /destroyer/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("arrow keys move focus across the board", () => {
    enter(createGame());
    const a1 = cell("Your fleet: placement", "A1");
    a1.focus();
    fireEvent.keyDown(a1, { key: "ArrowRight" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(cell("Your fleet: placement", "B2"));
    expect(document.activeElement).toHaveAttribute("tabindex", "0");
    expect(a1).toHaveAttribute("tabindex", "-1");
  });
});

describe("battle", () => {
  test("on your turn, clicking enemy water fires; the clock shows", () => {
    const ws = enter(playing());
    expect(screen.getByRole("status")).toHaveTextContent("Your turn: fire!");
    expect(screen.getByRole("status")).toHaveTextContent("60s left");
    fireEvent.click(cell("Enemy board", "J1"));
    expect(ws.sent.at(-1)).toEqual({ type: "fire", targets: [{ row: 0, col: 9 }] });
  });

  test("off turn the enemy board is read-only", () => {
    const ws = enter(ok(fire(playing(), 0, [{ row: 9, col: 9 }])));
    expect(screen.getByRole("status")).toHaveTextContent("Bob's turn");
    fireEvent.click(cell("Enemy board", "A1"));
    expect(ws.sent.at(-1)?.type).toBe("create");
  });

  test("the enemy board shows hits, misses and only sunk ships; your board shows your fleet", () => {
    let g = playing();
    for (const [r, c] of [[0, 9], [9, 9], [1, 9], [9, 8], [0, 8]]) g = ok(fire(g, g.turn, [{ row: r, col: c }]));
    enter(g);
    expect(cell("Enemy board", "J1")).toHaveAccessibleName("J1, sunk destroyer");
    expect(cell("Enemy board", "I1")).toHaveAccessibleName("I1, hit");
    expect(cell("Enemy board", "I2")).toHaveAccessibleName("I2, water");
    expect(cell("Your board", "A1")).toHaveAccessibleName("A1, carrier");
    expect(cell("Your board", "J10")).toHaveAccessibleName("J10, miss");
  });

  test("salvo: pick as many cells as you have ships afloat, then fire them together", () => {
    const ws = enter(playing(true));
    const fireButton = () => screen.getByRole("button", { name: /Fire salvo/ });
    for (const name of ["A1", "B1", "C1", "D1"]) fireEvent.click(cell("Enemy board", name));
    fireEvent.click(cell("Enemy board", "D1")); // un-aim
    expect(fireButton()).toBeDisabled();
    fireEvent.click(cell("Enemy board", "E1"));
    fireEvent.click(cell("Enemy board", "F1"));
    fireEvent.click(fireButton());
    expect(ws.sent.at(-1)).toEqual({ type: "fire", targets: [0, 1, 2, 4, 5].map(col => ({ row: 0, col })) });
  });

  test("game over names the winner and offers a rematch", () => {
    const ws = enter({ ...playing(), phase: "over", winner: 0 });
    expect(screen.getByRole("status")).toHaveTextContent("You won!");
    expect(cell("Enemy board", "F1")).toHaveAccessibleName("F1, carrier");
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(ws.sent.at(-1)).toEqual({ type: "rematch" });
  });

  test("when the opponent leaves mid-game the header says so, not 'waiting for an opponent'", () => {
    const ws = enter(playing());
    const over: BattleshipState = { ...playing(), phase: "over", winner: 0 };
    ws.push({ type: "state", room: snapshot(over, 0, { players: [{ name: "Ann", connected: true, host: true }, null] }) });
    expect(screen.getByText("Opponent left")).toBeInTheDocument();
    expect(screen.queryByText(/Waiting for an opponent/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("You won!");
  });

  test("a spectator sees both boards with neither fleet", () => {
    enter(playing(), null);
    expect(screen.getByText("You're watching.")).toBeInTheDocument();
    expect(cell("Ann's board", "A1")).toHaveAccessibleName("A1, water");
    expect(cell("Bob's board", "F1")).toHaveAccessibleName("F1, water");
  });
});
