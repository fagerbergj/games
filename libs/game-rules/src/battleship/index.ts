/**
 * Battleship rules: pure functions over plain-JSON state. A legal move returns the next
 * state; an illegal one returns an error string and leaves the input untouched.
 */

export const BOARD_SIZE = 10;

export const FLEET = [
  { id: "carrier", length: 5 },
  { id: "battleship", length: 4 },
  { id: "cruiser", length: 3 },
  { id: "submarine", length: 3 },
  { id: "destroyer", length: 2 },
] as const;

export type ShipId = (typeof FLEET)[number]["id"];
export type Seat = 0 | 1;

export interface Coord {
  row: number;
  col: number;
}

/** A ship anchored at its top-left cell, running right (or down when vertical). */
export interface Placement extends Coord {
  ship: ShipId;
  vertical: boolean;
}

/** No ship id on a hit: which ship was struck is only known once it sinks. */
export interface Shot extends Coord {
  hit: boolean;
}

export interface Board {
  fleet: Placement[];
  /** Placing is ready-up: a board with a fleet is ready. */
  ready: boolean;
  /** Shots fired at this board, in order. */
  shots: Shot[];
}

export interface BattleshipState {
  /** Salvo variant: each turn fires one shot per ship you still have afloat. */
  salvo: boolean;
  phase: "placing" | "playing" | "over";
  boards: [Board, Board];
  turn: Seat;
  winner: Seat | null;
}

const emptyBoard = (): Board => ({ fleet: [], ready: false, shots: [] });

export function createGame({ salvo = false }: { salvo?: boolean } = {}): BattleshipState {
  return { salvo, phase: "placing", boards: [emptyBoard(), emptyBoard()], turn: 0, winner: null };
}

export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

const shipLength = (ship: ShipId) => FLEET.find(s => s.id === ship)!.length;
const key = ({ row, col }: Coord) => row * BOARD_SIZE + col;
const inBounds = ({ row, col }: Coord) =>
  Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0 && row < BOARD_SIZE && col < BOARD_SIZE;

export function shipCells(p: Placement): Coord[] {
  return Array.from({ length: shipLength(p.ship) }, (_, i) =>
    p.vertical ? { row: p.row + i, col: p.col } : { row: p.row, col: p.col + i });
}

/** Why a fleet can't be placed, or null. Ships may touch; they may not overlap or leave the board. */
export function placementError(fleet: Placement[]): string | null {
  const ids = fleet.map(p => p.ship);
  if (fleet.length !== FLEET.length || FLEET.some(s => !ids.includes(s.id))) {
    return `place exactly one of each ship: ${FLEET.map(s => s.id).join(", ")}`;
  }
  const taken = new Set<number>();
  for (const p of fleet) {
    for (const cell of shipCells(p)) {
      if (!inBounds(cell)) return `${p.ship} runs off the board`;
      if (taken.has(key(cell))) return `${p.ship} overlaps another ship`;
      taken.add(key(cell));
    }
  }
  return null;
}

export const isSunk = (p: Placement, shots: Shot[]) =>
  shipCells(p).every(c => shots.some(s => s.hit && key(s) === key(c)));

export const sunkShips = (board: Board) => board.fleet.filter(p => isSunk(p, board.shots));

/** Shots `seat` must fire this turn: 1, or under salvo one per ship afloat (capped by open cells). */
export function shotsAllowed(state: BattleshipState, seat: Seat): number {
  if (!state.salvo) return 1;
  const own = state.boards[seat];
  const open = BOARD_SIZE * BOARD_SIZE - state.boards[other(seat)].shots.length;
  return Math.min(own.fleet.length - sunkShips(own).length, open);
}

function withBoard(state: BattleshipState, seat: Seat, board: Board): BattleshipState {
  const boards: [Board, Board] = [...state.boards];
  boards[seat] = board;
  return { ...state, boards };
}

/** Commits `seat`'s fleet and readies them; the game starts when both are ready, seat 0 first. */
export function placeFleet(state: BattleshipState, seat: Seat, fleet: Placement[]): BattleshipState | string {
  if (state.phase !== "placing") return "placement is over";
  if (state.boards[seat].ready) return "your fleet is already placed";
  const err = placementError(fleet);
  if (err) return err;
  const next = withBoard(state, seat, { ...state.boards[seat], fleet: fleet.map(p => ({ ...p })), ready: true });
  return next.boards.every(b => b.ready) ? { ...next, phase: "playing", turn: 0 } : next;
}

function targetError(state: BattleshipState, seat: Seat, targets: Coord[]): string | null {
  if (state.phase !== "playing") return "the game isn't in play";
  if (state.turn !== seat) return "not your turn";
  const allowed = shotsAllowed(state, seat);
  if (targets.length !== allowed) return allowed === 1 ? "fire exactly one shot" : `fire exactly ${allowed} shots`;
  const fired = new Set(state.boards[other(seat)].shots.map(key));
  for (const t of targets) {
    if (!inBounds(t)) return "that shot is off the board";
    if (fired.has(key(t))) return "you already fired there";
    fired.add(key(t));
  }
  return null;
}

/** Fires `targets` at the opponent. Sinking their last ship ends the game. */
export function fire(state: BattleshipState, seat: Seat, targets: Coord[]): BattleshipState | string {
  const err = targetError(state, seat, targets);
  if (err) return err;
  const foe = other(seat);
  const board = state.boards[foe];
  const occupied = new Set(board.fleet.flatMap(shipCells).map(key));
  const shots = [...board.shots, ...targets.map(({ row, col }) => ({ row, col, hit: occupied.has(key({ row, col })) }))];
  const next = withBoard(state, foe, { ...board, shots });
  if (board.fleet.every(p => isSunk(p, shots))) return { ...next, phase: "over", winner: seat };
  return { ...next, turn: foe };
}

/** Gives up the turn without firing (the server's turn timer uses this). */
export function pass(state: BattleshipState, seat: Seat): BattleshipState | string {
  if (state.phase !== "playing") return "the game isn't in play";
  if (state.turn !== seat) return "not your turn";
  return { ...state, turn: other(seat) };
}

export function resign(state: BattleshipState, seat: Seat): BattleshipState | string {
  if (state.phase === "over") return "the game is already over";
  return { ...state, phase: "over", winner: other(seat) };
}

/** A legal random fleet. `rng` is uniform [0, 1), like Math.random. */
export function randomFleet(rng: () => number): Placement[] {
  const fleet: Placement[] = [];
  for (const { id, length } of FLEET) {
    // ponytail: rejection sampling; 17 cells on 100 always fits, so this ends after a few draws.
    for (;;) {
      const vertical = rng() < 0.5;
      const span = BOARD_SIZE - length + 1;
      const p: Placement = {
        ship: id, vertical,
        row: Math.floor(rng() * (vertical ? span : BOARD_SIZE)),
        col: Math.floor(rng() * (vertical ? BOARD_SIZE : span)),
      };
      const taken = new Set(fleet.flatMap(shipCells).map(key));
      if (shipCells(p).every(c => !taken.has(key(c)))) {
        fleet.push(p);
        break;
      }
    }
  }
  return fleet;
}
