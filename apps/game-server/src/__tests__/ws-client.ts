import WebSocket from "ws";
import type { ServerMessage } from "@game-rules/protocol";

/** A ws client that records every frame and can await the first one matching a predicate. */
export async function connect<View, Out extends { type: string }>(url: string) {
  type Msg = ServerMessage<View>;
  const ws = new WebSocket(url);
  const seen: Msg[] = [];
  const waiters: { pred: (m: Msg) => boolean; resolve: (m: Msg) => void }[] = [];
  ws.on("message", data => {
    const m = JSON.parse(data.toString()) as Msg;
    seen.push(m);
    for (const w of waiters.filter(w => w.pred(m))) {
      waiters.splice(waiters.indexOf(w), 1);
      w.resolve(m);
    }
  });
  await new Promise(resolve => ws.once("open", resolve));
  const next = (pred: (m: Msg) => boolean) => new Promise<Msg>(resolve => waiters.push({ pred, resolve }));
  return {
    ws, seen,
    send: (m: Out | string) => ws.send(typeof m === "string" ? m : JSON.stringify(m)),
    next,
    state: (pred: (r: View) => boolean) =>
      next(m => m.type === "state" && pred(m.room)).then(m => (m as Extract<Msg, { type: "state" }>).room),
  };
}
