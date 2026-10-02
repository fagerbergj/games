import { randomInt } from "node:crypto";
import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { parseClientMessage, ROOM_CODE_ALPHABET, type ServerMessage } from "@game-rules/blackjack/protocol";
import { Room, DEFAULT_ROOM_OPTIONS, type RoomOptions } from "./room";

export interface GameServerOptions extends Partial<RoomOptions> {
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

export function sweepIdleRooms(rooms: Map<string, Room>, now: number, idleMs: number) {
  for (const [code, room] of rooms) {
    if (room.emptySince !== null && now - room.emptySince >= idleMs) {
      room.dispose();
      rooms.delete(code);
    }
  }
}

export function startGameServer(options: GameServerOptions = {}) {
  const { port, server, idleMs = 10 * 60_000, ...roomOverrides } = options;
  const roomOptions: RoomOptions = { ...DEFAULT_ROOM_OPTIONS, ...roomOverrides };
  const rooms = new Map<string, Room>();
  const wss = new WebSocketServer({ port, server, maxPayload: MAX_FRAME_BYTES });

  wss.on("connection", ws => attach(ws, rooms, roomOptions));
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
function attach(ws: WebSocket, rooms: Map<string, Room>, roomOptions: RoomOptions) {
  let room: Room | null = null;
  let token: string | null = null;
  const send = (m: ServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  };
  const fail = (message: string) => send({ type: "error", message });

  const onMessage = (raw: string) => {
    const msg = parseClientMessage(raw);
    if (typeof msg === "string") return fail(msg);
    if (msg.type === "create" || msg.type === "join") {
      if (room) return fail("already in a room");
      if (msg.type === "create" && rooms.size >= MAX_ROOMS) return fail("server is full");
      const target = msg.type === "create" ? new Room(newRoomCode(rooms), roomOptions) : rooms.get(msg.code);
      if (!target) return fail("no such room");
      rooms.set(target.code, target);
      room = target;
      token = target.join(msg.name, send, msg.type === "join" ? msg.token : undefined);
      return;
    }
    if (!room || !token) return fail("create or join a room first");
    const err = room.handle(token, msg, send);
    if (err) return fail(err);
    if (msg.type === "leave") {
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
