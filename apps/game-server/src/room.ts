import { randomBytes } from "node:crypto";
import { parseWith, ROOM_PARSERS, type Fields, type GameId, type Parsers, type RoomMessage, type ServerMessage } from "@game-rules/protocol";

export type Send<View> = (m: ServerMessage<View>) => void;

export interface Player<View> {
  token: string;
  name: string;
  slot: number | null;
  send: Send<View> | null;
  away: boolean;
  awayTimer?: ReturnType<typeof setTimeout>;
}

/**
 * The game-agnostic half of a room: players, tokens, reconnects, the away grace period and
 * broadcasting. A game is a subclass that owns its state, authorises moves by seat, decides
 * what each player may see, and runs its own timers. The server is the only writer of game state.
 */
export abstract class Room<Msg extends { type: string }, View> {
  abstract readonly game: GameId;
  readonly players = new Map<string, Player<View>>();
  hostToken: string | null = null;
  /** When the last connection dropped; idle-room GC keys on it. */
  emptySince: number | null = null;
  protected disposed = false;

  constructor(readonly code: string, private readonly awayMs: number, private readonly parsers: Parsers<Msg>) {}

  /** Applies `msg` from `p`, checking it's theirs to make; returns an error for the sender, or null. */
  protected abstract dispatch(p: Player<View>, msg: Msg): string | null;
  /** What `p` may see. Hidden information must never reach a player who shouldn't have it. */
  protected abstract view(p: Player<View>): View;
  /** Runs after every change, before the broadcast: auto-moves for absent players and timers. */
  protected abstract settle(): void;
  /** Frees whatever `p` held in the game; runs before they leave the player list. */
  protected abstract release(p: Player<View>): void;

  /** Adds a player, or re-attaches one whose token matches. Returns the player's token. */
  join(name: string, send: Send<View>, token?: string): string {
    const existing = token ? this.players.get(token) : undefined;
    if (existing) {
      if (existing.send && existing.send !== send) existing.send({ type: "error", message: "signed in from another connection" });
      clearTimeout(existing.awayTimer);
      Object.assign(existing, { send, away: false });
    } else {
      const fresh = randomBytes(18).toString("base64url");
      this.players.set(fresh, { token: fresh, name, slot: null, send, away: false });
      this.hostToken ??= fresh;
      token = fresh;
    }
    this.emptySince = null;
    send({ type: "joined", code: this.code, token: token! });
    this.afterChange();
    return token!;
  }

  /** A dropped socket keeps its seat; after awayMs the game auto-plays for it until it returns. */
  disconnect(token: string, send: Send<View>) {
    // Sockets terminated on shutdown close after dispose(); don't re-arm timers on a dead room.
    if (this.disposed) return;
    const p = this.players.get(token);
    if (!p || p.send !== send) return;
    p.send = null;
    p.awayTimer = setTimeout(() => {
      p.away = true;
      this.afterChange();
    }, this.awayMs);
    if (![...this.players.values()].some(q => q.send)) this.emptySince = Date.now();
    this.afterChange();
  }

  /** Parses an in-room frame with this game's schemas, then applies it. */
  receive(token: string, frame: Fields, send: Send<View>): string | null {
    const msg = parseWith<Msg | RoomMessage>(frame, { ...ROOM_PARSERS, ...this.parsers });
    return typeof msg === "string" ? msg : this.handle(token, msg, send);
  }

  /** Applies one in-room message from `token` sent over `send`'s socket; returns an error for the sender, or null. */
  handle(token: string, msg: Msg | RoomMessage, send: Send<View>): string | null {
    const p = this.players.get(token);
    if (!p) return "not in this room";
    // Only the player's live socket speaks for them; a tab superseded by a reconnect can't race it.
    if (p.send !== send) return "signed in from another connection";
    let err: string | null;
    if (msg.type === "leave") err = this.leave(p);
    else if (msg.type === "create" || msg.type === "join") err = "already in a room";
    else err = this.dispatch(p, msg as Msg);
    if (!err) this.afterChange();
    return err;
  }

  snapshotFor(token: string): View | null {
    const p = this.players.get(token);
    return p ? this.view(p) : null;
  }

  dispose() {
    this.disposed = true;
    for (const p of this.players.values()) clearTimeout(p.awayTimer);
  }

  protected ownerOf(slot: number): Player<View> | undefined {
    return [...this.players.values()].find(p => p.slot === slot);
  }

  /** The host directs the room; anyone may while the host is disconnected, so the room never stalls on them. */
  protected canDirect(p: Player<View>): boolean {
    const host = this.hostToken ? this.players.get(this.hostToken) : undefined;
    return p === host || !host?.send;
  }

  private leave(p: Player<View>): null {
    clearTimeout(p.awayTimer);
    this.release(p);
    this.players.delete(p.token);
    if (this.hostToken === p.token) this.hostToken = this.players.keys().next().value ?? null;
    return null;
  }

  protected afterChange() {
    this.settle();
    for (const p of this.players.values()) {
      if (p.send) p.send({ type: "state", room: this.view(p) });
    }
  }
}
