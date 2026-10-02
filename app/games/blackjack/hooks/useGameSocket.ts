import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RoomSnapshot, ServerMessage } from "@game-rules/blackjack/protocol";

const SESSION_KEY = "blackjack_mp_session";
const RETRY_MS = 1000;

interface Session { code: string; token: string; name: string }

function serverUrl(): string {
  if (process.env.NEXT_PUBLIC_GAME_SERVER_URL) return process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}

// Per tab, so a refresh reclaims the seat but a second tab is a second player.
function loadSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable: the seat just won't survive a reload
  }
}

const rejoin = (s: Session): ClientMessage => ({ type: "join", code: s.code, name: s.name, token: s.token });

/** One connection to the game server: latest room snapshot, last error, and a sender. */
export function useGameSocket() {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What to say on (re)connect; each new value opens a fresh socket. `attempt` forces a redial.
  const [target, setTarget] = useState<{ hello: ClientMessage; name: string; attempt: number } | null>(null);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    const s = loadSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
    if (s) setTarget({ hello: rejoin(s), name: s.name, attempt: 0 });
  }, []);

  useEffect(() => {
    if (!target) return;
    const ws = new WebSocket(serverUrl());
    socket.current = ws;
    let retry: ReturnType<typeof setTimeout> | undefined;
    ws.onopen = () => ws.send(JSON.stringify(target.hello));
    ws.onmessage = e => {
      const m = JSON.parse(String(e.data)) as ServerMessage;
      if (m.type === "joined") saveSession({ code: m.code, token: m.token, name: target.name });
      else if (m.type === "state") {
        setRoom(m.room);
        setError(null);
      } else setError(m.message);
    };
    ws.onclose = () => {
      const s = loadSession();
      // Only redial a room we got into; a refused create/join just leaves the lobby showing the error.
      if (s) retry = setTimeout(() => setTarget({ hello: rejoin(s), name: s.name, attempt: target.attempt + 1 }), RETRY_MS);
    };
    return () => {
      clearTimeout(retry);
      ws.onclose = null;
      ws.close();
      if (socket.current === ws) socket.current = null;
    };
  }, [target]);

  // A rejoin the server refuses (room expired) must not redial forever.
  useEffect(() => {
    if (error && !room) saveSession(null);
  }, [error, room]);

  const send = useCallback((m: ClientMessage) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(m));
  }, []);

  const leave = useCallback(() => {
    send({ type: "leave" });
    saveSession(null);
    setTarget(null);
    setRoom(null);
  }, [send]);

  return {
    room,
    error,
    create: (name: string) => setTarget({ hello: { type: "create", name }, name, attempt: 0 }),
    join: (code: string, name: string) => setTarget({ hello: { type: "join", code, name }, name, attempt: 0 }),
    send,
    leave,
  };
}
