import { getActiveHandActions, MAX_SEATS } from "./table";
import type { BlackjackTableState, Card } from "./types";
import { isInt, parseMessage, ROOM_PARSERS, type Parsers, type RoomMessage, type ServerMessage as Envelope } from "../protocol";

/** Blackjack's in-room messages between the multiplayer page and apps/game-server. */

export const MOVES = ["hit", "stand", "double", "split", "surrender", "insurance", "declineInsurance", "evenMoney", "buyBackIn"] as const;
export type Move = (typeof MOVES)[number];

export type BlackjackMessage =
  | { type: "sit"; seat: number }
  | { type: "bet"; amount: number }
  | { type: "action"; action: Move }
  | { type: "start" }
  | { type: "newRound" };

export type ClientMessage = RoomMessage | BlackjackMessage;

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

export type ServerMessage = Envelope<RoomSnapshot>;

// A fixed stand-in, not the real card with fields stripped: real card ids encode suit and rank.
export const HIDDEN_CARD: Card = { id: "hole", suit: "spades", rank: 0, faceUp: false };

export function publicTable(state: BlackjackTableState): PublicTable {
  const { deck, ...rest } = state;
  return { ...rest, shoeRemaining: deck.length, dealerHand: state.dealerHand.map(c => (c.faceUp ? c : HIDDEN_CARD)) };
}

export const BLACKJACK_PARSERS: Parsers<BlackjackMessage> = {
  sit: m => (isInt(m.seat, 0, MAX_SEATS - 1) ? { type: "sit", seat: m.seat as number } : `seat must be 0-${MAX_SEATS - 1}`),
  bet: m => (isInt(m.amount, 1, 1_000_000) ? { type: "bet", amount: m.amount as number } : "bet must be a whole positive amount"),
  action: m => (MOVES.includes(m.action as Move) ? { type: "action", action: m.action as Move } : "unknown action"),
  start: () => ({ type: "start" }),
  newRound: () => ({ type: "newRound" }),
};

/** Parses one inbound frame from a blackjack client; returns an error string instead of throwing on anything malformed. */
export const parseClientMessage = (raw: string) => parseMessage<ClientMessage>(raw, { ...ROOM_PARSERS, ...BLACKJACK_PARSERS });
