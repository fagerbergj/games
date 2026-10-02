import { getActiveHandActions, MAX_SEATS } from "./table";
import type { BlackjackTableState, Card } from "./types";

/** Wire protocol between the multiplayer blackjack page and apps/game-server. */

export const MOVES = ["hit", "stand", "double", "split", "surrender", "insurance", "declineInsurance", "evenMoney", "buyBackIn"] as const;
export type Move = (typeof MOVES)[number];

export type ClientMessage =
  | { type: "create"; name: string }
  | { type: "join"; code: string; name: string; token?: string }
  | { type: "leave" }
  | { type: "sit"; seat: number }
  | { type: "bet"; amount: number }
  | { type: "action"; action: Move }
  | { type: "start" }
  | { type: "newRound" };

/** The table as a client may see it: no shoe, and the hole card masked until the dealer flips it. */
export interface PublicTable extends Omit<BlackjackTableState, "deck"> {
  shoeRemaining: number;
}

export interface SlotInfo {
  name: string;
  connected: boolean;
  host: boolean;
}

export interface RoomSnapshot {
  code: string;
  /** canDirect: may deal and start a new round (the host, or anyone while the host is disconnected). */
  you: { seat: number | null; isHost: boolean; canDirect: boolean; actions: ReturnType<typeof getActiveHandActions> };
  /** One entry per seat position; null = empty. A seated player missing from table.seats sits out this round. */
  slots: (SlotInfo | null)[];
  table: PublicTable;
  count: { running: number; lastCard?: { card: Card; delta: number }; justReshuffled: boolean };
}

export type ServerMessage =
  | { type: "joined"; code: string; token: string }
  | { type: "state"; room: RoomSnapshot }
  | { type: "error"; message: string };

// No 0/O, 1/I/L: codes get read aloud and typed on phones.
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{6}$`);
export const MAX_NAME_LENGTH = 20;

// A fixed stand-in, not the real card with fields stripped: real card ids encode suit and rank.
export const HIDDEN_CARD: Card = { id: "hole", suit: "spades", rank: 0, faceUp: false };

export function publicTable(state: BlackjackTableState): PublicTable {
  const { deck, ...rest } = state;
  return { ...rest, shoeRemaining: deck.length, dealerHand: state.dealerHand.map(c => (c.faceUp ? c : HIDDEN_CARD)) };
}

type Fields = Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_NAME_LENGTH) : "") || "Player";

const PARSERS: Record<ClientMessage["type"], (m: Fields) => ClientMessage | string> = {
  create: m => ({ type: "create", name: cleanName(m.name) }),
  join: m => {
    const code = typeof m.code === "string" ? m.code.trim().toUpperCase() : "";
    if (!ROOM_CODE_PATTERN.test(code)) return "room code must be 6 letters/digits";
    if (m.token !== undefined && (typeof m.token !== "string" || m.token.length > 64)) return "bad token";
    return { type: "join", code, name: cleanName(m.name), ...(m.token ? { token: m.token as string } : {}) };
  },
  leave: () => ({ type: "leave" }),
  sit: m => (isInt(m.seat, 0, MAX_SEATS - 1) ? { type: "sit", seat: m.seat as number } : `seat must be 0-${MAX_SEATS - 1}`),
  bet: m => (isInt(m.amount, 1, 1_000_000) ? { type: "bet", amount: m.amount as number } : "bet must be a whole positive amount"),
  action: m => (MOVES.includes(m.action as Move) ? { type: "action", action: m.action as Move } : "unknown action"),
  start: () => ({ type: "start" }),
  newRound: () => ({ type: "newRound" }),
};

/** Parses one inbound frame; returns an error string instead of throwing on anything malformed. */
export function parseClientMessage(raw: string): ClientMessage | string {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return "not JSON";
  }
  if (!m || typeof m !== "object" || Array.isArray(m)) return "message must be an object";
  const type = (m as Fields).type;
  if (typeof type !== "string" || !Object.hasOwn(PARSERS, type)) return "unknown message type";
  return PARSERS[type as ClientMessage["type"]](m as Fields);
}
