import type { GameId } from "@game-rules/protocol";
import { BlackjackRoom, DEFAULT_BLACKJACK_OPTIONS, type BlackjackRoomOptions } from "./blackjack";

/** Per-game option overrides, passed to every game; each takes the keys it knows. */
export type RoomOverrides = Partial<BlackjackRoomOptions>;

/** How to open a room for each game the server hosts. */
export const GAMES = {
  blackjack: (code: string, o: RoomOverrides) => new BlackjackRoom(code, { ...DEFAULT_BLACKJACK_OPTIONS, ...o }),
} satisfies Record<GameId, (code: string, o: RoomOverrides) => unknown>;

export type AnyRoom = ReturnType<(typeof GAMES)[GameId]>;
