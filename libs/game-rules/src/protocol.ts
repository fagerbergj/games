/**
 * Wire protocol shared by every multiplayer game and apps/game-server: the room envelope
 * (create, join, leave) and server replies. Each game adds its own in-room messages.
 */

export const GAME_IDS = ["blackjack"] as const;
export type GameId = (typeof GAME_IDS)[number];

export type RoomMessage =
  /** No `game` means blackjack, the first game the server hosted. */
  | { type: "create"; name: string; game?: GameId }
  | { type: "join"; code: string; name: string; token?: string }
  | { type: "leave" };

export type ServerMessage<View> =
  | { type: "joined"; code: string; token: string }
  | { type: "state"; room: View }
  | { type: "error"; message: string };

// No 0/O, 1/I/L: codes get read aloud and typed on phones.
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{6}$`);
export const MAX_NAME_LENGTH = 20;

export type Fields = Record<string, unknown> & { type: string };
/** One validator per message type: the message, or an error string for the sender. */
export type Parsers<M extends { type: string }> = { [T in M["type"]]: (m: Fields) => M | string };

export const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_NAME_LENGTH) : "") || "Player";

export const ROOM_PARSERS: Parsers<RoomMessage> = {
  create: m => {
    if (m.game !== undefined && !GAME_IDS.includes(m.game as GameId)) return "unknown game";
    return { type: "create", name: cleanName(m.name), ...(m.game ? { game: m.game as GameId } : {}) };
  },
  join: m => {
    const code = typeof m.code === "string" ? m.code.trim().toUpperCase() : "";
    if (!ROOM_CODE_PATTERN.test(code)) return "room code must be 6 letters/digits";
    if (m.token !== undefined && (typeof m.token !== "string" || m.token.length > 64)) return "bad token";
    return { type: "join", code, name: cleanName(m.name), ...(m.token ? { token: m.token as string } : {}) };
  },
  leave: () => ({ type: "leave" }),
};

/** Decodes one inbound frame to an object with a string `type`, or an error. */
export function parseFrame(raw: string): Fields | string {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return "not JSON";
  }
  if (!m || typeof m !== "object" || Array.isArray(m)) return "message must be an object";
  if (typeof (m as Fields).type !== "string") return "unknown message type";
  return m as Fields;
}

export function parseWith<M extends { type: string }>(frame: Fields, parsers: Parsers<M>): M | string {
  // hasOwn, so "toString" and friends aren't mistaken for message types.
  if (!Object.hasOwn(parsers, frame.type)) return "unknown message type";
  return parsers[frame.type as M["type"]](frame);
}

/** Parses one raw frame against `parsers`; returns an error string instead of throwing. */
export function parseMessage<M extends { type: string }>(raw: string, parsers: Parsers<M>): M | string {
  const frame = parseFrame(raw);
  return typeof frame === "string" ? frame : parseWith(frame, parsers);
}
