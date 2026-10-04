import { useCallback, useEffect, useRef, useState } from "react";
import type { GameId, RoomMessage, ServerMessage } from "@game-rules/protocol";

const RETRY_MS = 1000;
const MAX_RETRY_MS = 8000;
// About half a minute of backoff before telling the user; a refresh tries again.
const MAX_ATTEMPTS = 6;
const MAX_QUEUED = 20;
const UNREACHABLE = "Can't reach the game server. Refresh to try again.";

interface Session { code: string; token: string; name: string }

function serverUrl(): string {
  if (process.env.NEXT_PUBLIC_GAME_SERVER_URL) return process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}

const sessionKey = (game: GameId) => `${game}_mp_session`;

// Per tab, so a refresh reclaims the seat but a second tab is a second player.
function loadSession(game: GameId): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey(game)) ?? "null");
  } catch {
    return null;
  }
}

function saveSession(game: GameId, s: Session | null) {
  try {
    if (s) sessionStorage.setItem(sessionKey(game), JSON.stringify(s));
    else sessionStorage.removeItem(sessionKey(game));
  } catch {
    // storage unavailable: the seat just won't survive a reload
  }
}

const rejoin = (game: GameId, s: Session): RoomMessage => ({ type: "join", code: s.code, name: s.name, token: s.token, game });

/** One connection to the game server for `game`: latest room snapshot, last error, and a sender. */
export function useGameSocket<View, Msg extends { type: string }>(game: GameId) {
  type Out = Msg | RoomMessage;
  const [room, setRoom] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What to say on (re)connect; each new value opens a fresh socket. `attempt` forces a redial.
  const [target, setTarget] = useState<{ hello: RoomMessage; name: string; attempt: number } | null>(null);
  const socket = useRef<WebSocket | null>(null);
  // Frames sent while (re)connecting; flushed once the server has re-attached us to the room.
  const queue = useRef<Out[]>([]);

  useEffect(() => {
    const s = loadSession(game);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
    if (s) setTarget({ hello: rejoin(game, s), name: s.name, attempt: 0 });
  }, [game]);

  useEffect(() => {
    if (!target) return;
    const ws = new WebSocket(serverUrl());
    let retry: ReturnType<typeof setTimeout> | undefined;
    let joined = false;
    ws.onopen = () => ws.send(JSON.stringify(target.hello));
    ws.onmessage = e => {
      const m = JSON.parse(String(e.data)) as ServerMessage<View>;
      if (m.type === "joined") {
        joined = true;
        // Sends go straight out only once the server has attached this socket; until then they queue.
        socket.current = ws;
        saveSession(game, { code: m.code, token: m.token, name: target.name });
        for (const q of queue.current.splice(0)) ws.send(JSON.stringify(q));
      } else if (m.type === "state") {
        setRoom(m.room);
        setError(null);
      } else {
        // An error before `joined` is the server refusing our hello (e.g. the room expired): stop rejoining it.
        if (!joined) {
          saveSession(game, null);
          queue.current = [];
          setRoom(null);
        }
        setError(m.message);
      }
    };
    ws.onclose = () => {
      const s = loadSession(game);
      // Only redial a room we got into; a refused create/join just leaves the lobby showing the error.
      if (!s) return;
      const attempt = joined ? 1 : target.attempt + 1;
      if (attempt > MAX_ATTEMPTS) {
        queue.current = [];
        setError(UNREACHABLE);
        return;
      }
      const delay = Math.min(RETRY_MS * 2 ** (attempt - 1), MAX_RETRY_MS);
      retry = setTimeout(() => setTarget({ hello: rejoin(game, s), name: s.name, attempt }), delay);
    };
    return () => {
      clearTimeout(retry);
      ws.onclose = null;
      ws.close();
      if (socket.current === ws) socket.current = null;
    };
  }, [game, target]);

  const send = useCallback((m: Out) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(m));
    else if (queue.current.length < MAX_QUEUED) queue.current.push(m);
    else setError("Not connected to the game server; that action wasn't sent.");
  }, []);

  const leave = useCallback(() => {
    send({ type: "leave" });
    queue.current = [];
    saveSession(game, null);
    setTarget(null);
    setRoom(null);
    setError(null);
  }, [game, send]);

  const connect = (hello: RoomMessage, name: string) => {
    queue.current = [];
    setTarget({ hello, name, attempt: 0 });
  };

  return {
    room,
    error,
    create: (name: string) => connect({ type: "create", name, game }, name),
    join: (code: string, name: string) => connect({ type: "join", code, name, game }, name),
    send,
    leave,
  };
}
