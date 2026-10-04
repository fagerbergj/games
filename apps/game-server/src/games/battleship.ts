import {
  createGame, fire, other, pass, placeFleet, randomFleet, resign, type BattleshipState, type Seat,
} from "@game-rules/battleship";
import {
  BATTLESHIP_PARSERS, publicBoards, turnShots, type BattleshipMessage, type BattleshipSnapshot,
} from "@game-rules/battleship/protocol";
import { Room, type Player as RoomPlayer } from "../room";

export interface BattleshipRoomOptions {
  /** How long a connected player has to fire before their turn passes. */
  turnMs: number;
  /** How long a disconnected player is waited for before the game plays on without them. */
  awayMs: number;
  /** Only used to place a fleet for a player who went away mid-placement. */
  rng: () => number;
}

export const DEFAULT_BATTLESHIP_OPTIONS: BattleshipRoomOptions = { turnMs: 60_000, awayMs: 30_000, rng: Math.random };

type Player = RoomPlayer<BattleshipSnapshot>;
const SEATS: Seat[] = [0, 1];

/** Two seats; anyone after that watches. A player sees their own fleet, and the other's only as ships sink. */
export class BattleshipRoom extends Room<BattleshipMessage, BattleshipSnapshot> {
  readonly game = "battleship";
  state: BattleshipState = createGame();

  private clock: ReturnType<typeof setTimeout> | null = null;
  private clockEndsAt = 0;
  /** The state the turn clock was armed for; any move during play replaces it, which re-arms the clock. */
  private clocked: BattleshipState | null = null;

  constructor(code: string, private readonly opts: BattleshipRoomOptions = DEFAULT_BATTLESHIP_OPTIONS) {
    super(code, opts.awayMs, BATTLESHIP_PARSERS);
  }

  protected view(p: Player): BattleshipSnapshot {
    const s = this.state;
    const seat = p.slot as Seat | null;
    const info = (i: Seat) => {
      const o = this.ownerOf(i);
      return o ? { name: o.name, connected: o.send !== null, host: o.token === this.hostToken } : null;
    };
    return {
      code: this.code,
      you: { seat, isHost: p.token === this.hostToken },
      players: [info(0), info(1)],
      phase: s.phase, salvo: s.salvo, turn: s.turn, winner: s.winner,
      shotsAllowed: turnShots(s),
      turnMsLeft: this.clock ? Math.max(0, this.clockEndsAt - Date.now()) : null,
      boards: publicBoards(s, seat),
    };
  }

  protected dispatch(p: Player, msg: BattleshipMessage): string | null {
    if (p.slot === null) return "you're watching this game";
    const seat = p.slot as Seat;
    switch (msg.type) {
      case "place": return this.apply(placeFleet(this.state, seat, msg.fleet));
      case "fire": return this.apply(fire(this.state, seat, msg.targets));
      case "salvo": return this.setSalvo(p, msg.on);
      case "rematch":
        if (this.state.phase !== "over") return "the game isn't over";
        this.state = createGame({ salvo: this.state.salvo });
        return null;
    }
  }

  /** Leaving mid-game concedes it; leaving mid-placement clears the seat for whoever sits next. */
  protected release(p: Player) {
    if (p.slot === null) return;
    const seat = p.slot as Seat;
    if (this.state.phase === "playing") this.apply(resign(this.state, seat));
    if (this.state.phase === "placing") {
      const boards: BattleshipState["boards"] = [...this.state.boards];
      boards[seat] = { fleet: [], ready: false, shots: [] };
      this.state = { ...this.state, boards };
    }
  }

  protected settle() {
    this.seatWatchers();
    this.autoPlay();
    this.armClock();
  }

  dispose() {
    super.dispose();
    this.stopClock();
  }

  private apply(next: BattleshipState | string): string | null {
    if (typeof next === "string") return next;
    this.state = next;
    return null;
  }

  private setSalvo(p: Player, on: boolean): string | null {
    if (!this.canDirect(p)) return "only the host can change the rules";
    if (this.state.phase !== "placing" || this.state.boards.some(b => b.ready)) return "rules are fixed once a fleet is placed";
    this.state = createGame({ salvo: on });
    return null;
  }

  /** Fills an empty seat from the watchers, except mid-game where a newcomer would inherit someone else's board. */
  private seatWatchers() {
    if (this.state.phase === "playing") return;
    for (const seat of SEATS) {
      if (this.ownerOf(seat)) continue;
      const watcher = [...this.players.values()].find(p => p.slot === null);
      if (watcher) watcher.slot = seat;
    }
  }

  /** An away player is placed for, and their turns pass, but only while a connected opponent is waiting on them. */
  private autoPlay() {
    const s = this.state;
    const away = (seat: Seat) => this.ownerOf(seat)?.away ?? false;
    const present = (seat: Seat) => !!this.ownerOf(seat)?.send;
    if (s.phase === "placing") {
      for (const seat of SEATS) {
        if (away(seat) && present(other(seat)) && !s.boards[seat].ready) this.apply(placeFleet(this.state, seat, randomFleet(this.opts.rng)));
      }
    } else if (s.phase === "playing" && away(s.turn) && present(other(s.turn))) {
      this.apply(pass(s, s.turn));
    }
  }

  private armClock() {
    if (this.state === this.clocked) return;
    this.stopClock();
    if (this.state.phase !== "playing") return;
    this.clocked = this.state;
    this.clockEndsAt = Date.now() + this.opts.turnMs;
    this.clock = setTimeout(() => {
      this.clock = null;
      this.apply(pass(this.state, this.state.turn));
      this.afterChange();
    }, this.opts.turnMs);
  }

  private stopClock() {
    if (this.clock) clearTimeout(this.clock);
    this.clock = null;
    this.clocked = null;
  }
}
