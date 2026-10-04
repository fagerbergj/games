import { BOARD_SIZE, FLEET, shotsAllowed, sunkShips, type BattleshipState, type Board, type Coord, type Placement, type Seat, type Shot, type ShipId } from ".";
import { isInt, type Fields, type Parsers, type RoomMessage, type ServerMessage as Envelope } from "../protocol";

/** Battleship's in-room messages between /games/battleship and apps/game-server. */

export type BattleshipMessage =
  | { type: "place"; fleet: Placement[] }
  | { type: "fire"; targets: Coord[] }
  /** Host only, before anyone has placed. */
  | { type: "salvo"; on: boolean }
  | { type: "rematch" };

export type ClientMessage = RoomMessage | BattleshipMessage;

/** A board as one viewer may see it. `ships` is the whole fleet only for its owner or after the game ends. */
export interface PublicBoard {
  ready: boolean;
  shots: Shot[];
  ships: Placement[];
}

export interface PlayerInfo {
  name: string;
  connected: boolean;
  host: boolean;
}

export interface BattleshipSnapshot {
  code: string;
  /** seat is null for a spectator. */
  you: { seat: Seat | null; isHost: boolean };
  players: [PlayerInfo | null, PlayerInfo | null];
  phase: BattleshipState["phase"];
  salvo: boolean;
  turn: Seat;
  winner: Seat | null;
  /** Shots the player on turn must fire. */
  shotsAllowed: number;
  /** Time left on the turn clock when this snapshot was sent; null outside play. */
  turnMsLeft: number | null;
  boards: [PublicBoard, PublicBoard];
}

export type ServerMessage = Envelope<BattleshipSnapshot>;

/** The hidden-information filter: unsunk ships stay off the wire for everyone but their owner until the game ends. */
export function publicBoard(board: Board, reveal: boolean): PublicBoard {
  return { ready: board.ready, shots: board.shots, ships: reveal ? board.fleet : sunkShips(board) };
}

export function publicBoards(state: BattleshipState, viewer: Seat | null): [PublicBoard, PublicBoard] {
  const over = state.phase === "over";
  return [publicBoard(state.boards[0], over || viewer === 0), publicBoard(state.boards[1], over || viewer === 1)];
}

export const turnShots = (state: BattleshipState) => (state.phase === "playing" ? shotsAllowed(state, state.turn) : 0);

const SHIP_IDS: readonly string[] = FLEET.map(s => s.id);
const isCell = (v: unknown): v is Coord =>
  !!v && typeof v === "object" && isInt((v as Coord).row, 0, BOARD_SIZE - 1) && isInt((v as Coord).col, 0, BOARD_SIZE - 1);
const isPlacement = (v: unknown): v is Placement =>
  isCell(v) && SHIP_IDS.includes((v as Placement).ship) && typeof (v as Placement).vertical === "boolean";

// Shape only; whether the fleet or the shots are legal is the rules' call.
export const BATTLESHIP_PARSERS: Parsers<BattleshipMessage> = {
  place: (m: Fields) => {
    const fleet = m.fleet;
    if (!Array.isArray(fleet) || fleet.length !== FLEET.length || !fleet.every(isPlacement)) return "fleet must list each ship once";
    return { type: "place", fleet: fleet.map(({ ship, row, col, vertical }) => ({ ship: ship as ShipId, row, col, vertical })) };
  },
  fire: (m: Fields) => {
    const t = m.targets;
    if (!Array.isArray(t) || t.length < 1 || t.length > FLEET.length || !t.every(isCell)) return "targets must be 1-5 board cells";
    return { type: "fire", targets: t.map(({ row, col }) => ({ row, col })) };
  },
  salvo: (m: Fields) => (typeof m.on === "boolean" ? { type: "salvo", on: m.on } : "salvo must be on or off"),
  rematch: () => ({ type: "rematch" }),
};
