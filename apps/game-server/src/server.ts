import { randomInt } from "node:crypto";
import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { parseFrame, parseWith, ROOM_CODE_ALPHABET, ROOM_PARSERS, type RoomMessage, type ServerMessage } from "@game-rules/protocol";
import { GAMES, type AnyRoom, type RoomOverrides } from "./games";

export interface GameServerOptions extends RoomOverrides {
  /** Listen on this port, or attach to an existing http server. */
  port?: number;
  server?: Server;
  /** A room with nobody connected for this long is dropped. */
  idleMs?: number;
}

// ponytail: in-memory caps, no per-IP rate limiting; add a limiter if this is ever exposed beyond friends.
const MAX_ROOMS = 500;
const MAX_FRAME_BYTES = 4096;
const GC_INTERVAL_MS = 60_000;

export function newRoomCode(taken: { has(code: string): boolean }): string {
  for (;;) {
    const code = Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join("");
    if (!taken.has(code)) return code;
  }
}

export function sweepIdleRooms(rooms: Map<string, AnyRoom>, now: number, idleMs: number) {
  for (const [code, room] of rooms) {
    if (room.emptySince !== null && now - room.emptySince >= idleMs) {
      room.dispose();
      rooms.delete(code);
    }
  }
}

export function startGameServer(options: GameServerOptions = {}) {
  const { port, server, idleMs = 10 * 60_000, ...roomOverrides } = options;
  const rooms = new Map<string, AnyRoom>();
  const wss = new WebSocketServer({ port, server, maxPayload: MAX_FRAME_BYTES });

  wss.on("connection", ws => attach(ws, rooms, roomOverrides));
  const gc = setInterval(() => sweepIdleRooms(rooms, Date.now(), idleMs), GC_INTERVAL_MS);
  gc.unref();

  return {
    wss,
    rooms,
    close: () => new Promise<void>(resolve => {
      clearInterval(gc);
      for (const room of rooms.values()) room.dispose();
      for (const client of wss.clients) client.terminate();
      wss.close(() => resolve());
    }),
  };
}

/** One socket's session: which room and player token it speaks for, if any. */
function attach(ws: WebSocket, rooms: Map<string, AnyRoom>, overrides: RoomOverrides) {
  let room: AnyRoom | null = null;
  let token: string | null = null;
  const send = (m: ServerMessage<unknown>) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  };
  const fail = (message: string) => send({ type: "error", message });

  const enter = (msg: Extract<RoomMessage, { type: "create" | "join" }>) => {
    if (room) return fail("already in a room");
    if (msg.type === "create" && rooms.size >= MAX_ROOMS) return fail("server is full");
    const target = msg.type === "create" ? GAMES[msg.game ?? "blackjack"](newRoomCode(rooms), overrides) : rooms.get(msg.code);
    if (!target) return fail("no such room");
    rooms.set(target.code, target);
    room = target;
    token = target.join(msg.name, send, msg.type === "join" ? msg.token : undefined);
  };

  const onMessage = (raw: string) => {
    const frame = parseFrame(raw);
    if (typeof frame === "string") return fail(frame);
    if (frame.type === "create" || frame.type === "join") {
      const msg = parseWith(frame, ROOM_PARSERS);
      return typeof msg === "string" ? fail(msg) : enter(msg as Parameters<typeof enter>[0]);
    }
    // In-room messages are parsed by the room, against its own game's schemas.
    if (!room || !token) return fail("create or join a room first");
    const err = room.receive(token, frame, send);
    if (err) return fail(err);
    if (frame.type === "leave") {
      if (room.players.size === 0) {
        room.dispose();
        rooms.delete(room.code);
      }
      room = token = null;
    }
  };

  ws.on("message", (data, isBinary) => {
    try {
      if (isBinary) return fail("text frames only");
      onMessage(data.toString());
    } catch (e) {
      console.error("game-server: message handler failed", e);
      fail("internal error");
    }
  });
  // Oversized or malformed frames surface here; without a listener the emitter throws and kills the process.
  ws.on("error", e => console.error("game-server: socket error", e.message));
  ws.on("close", () => {
    if (room && token) room.disconnect(token, send);
  });
}
