import {
  createTable, createSeat, placeBet, startRound, needsReshuffle, hit, stand, doubleDown, split, surrender,
  takeInsurance, declineInsurance, takeEvenMoney, resetSeatBankroll, pendingDealHandId, dealSecondCardIfNeeded,
  finishDealerAndSettle, resetRound, getActiveHandActions, hiLoValue, DEFAULT_HOUSE_RULES, DEFAULT_DECK_COUNT,
  STARTING_BANKROLL, MAX_SEATS, type BlackjackTableState, type Card, type Rng, type Seat,
} from "@game-rules/blackjack";
import { BLACKJACK_PARSERS, publicTable, type BlackjackMessage, type Move, type RoomSnapshot } from "@game-rules/blackjack/protocol";
import { Room, type Player as RoomPlayer } from "../room";

export interface BlackjackRoomOptions {
  /** Delay for each timed beat: a split hand's second card, each dealer draw. */
  beatMs: number;
  /** How long a disconnected player keeps the table waiting before their turns are auto-played. */
  awayMs: number;
  rng: Rng;
  deckCount: number;
}

export const DEFAULT_BLACKJACK_OPTIONS: BlackjackRoomOptions = { beatMs: 600, awayMs: 30_000, rng: Math.random, deckCount: DEFAULT_DECK_COUNT };

// The client's smallest chip; below it a seat can't bet at all, so buy-back is allowed.
const MIN_CHIP = 5;

type Player = RoomPlayer<RoomSnapshot>;

const seatId = (slot: number) => `slot-${slot}`;
const slotOf = (seat: Seat) => Number(seat.id.slice("slot-".length));
const bySlot = (a: Seat, b: Seat) => slotOf(a) - slotOf(b);

const PLAY_MOVES: Partial<Record<Move, (s: BlackjackTableState, o: BlackjackRoomOptions) => BlackjackTableState>> = {
  hit: (s, o) => hit(s, o.deckCount, o.rng),
  stand: s => stand(s),
  double: (s, o) => doubleDown(s, o.deckCount, o.rng),
  split: (s, o) => split(s, o.rng),
  surrender: s => surrender(s),
};

const INSURANCE_MOVES: Partial<Record<Move, (s: BlackjackTableState, i: number) => BlackjackTableState>> = {
  insurance: (s, i) => takeInsurance(s, i, s.seats[i].hands[0].bet / 2),
  declineInsurance: (s, i) => declineInsurance(s, i),
  evenMoney: (s, i) => takeEvenMoney(s, i),
};

/** One blackjack table. Snapshots never carry the shoe or the face-down hole card. */
export class BlackjackRoom extends Room<BlackjackMessage, RoomSnapshot> {
  readonly game = "blackjack";
  table: BlackjackTableState;
  /** Seated players not dealt into the current round (no bet, or sat down mid-round). */
  readonly bench = new Map<number, Seat>();

  private beat: ReturnType<typeof setTimeout> | null = null;
  private settled: BlackjackTableState | null = null;
  private counted = new Set<string>();
  private count: RoomSnapshot["count"] = { running: 0, justReshuffled: false };

  constructor(code: string, private readonly opts: BlackjackRoomOptions = DEFAULT_BLACKJACK_OPTIONS) {
    super(code, opts.awayMs, BLACKJACK_PARSERS);
    this.table = { ...createTable(1, DEFAULT_HOUSE_RULES, opts.deckCount, opts.rng), seats: [] };
  }

  protected view(p: Player): RoomSnapshot {
    const mine = this.seatIndex(p);
    return {
      code: this.code,
      you: {
        seat: p.slot,
        isHost: p.token === this.hostToken,
        canDirect: this.canDirect(p),
        actions: mine >= 0 && mine === this.table.activeSeatIndex ? getActiveHandActions(this.table) : null,
      },
      slots: Array.from({ length: MAX_SEATS }, (_, i) => {
        const o = this.ownerOf(i);
        return o ? { name: o.name, connected: o.send !== null, host: o.token === this.hostToken } : null;
      }),
      table: publicTable(this.table),
      count: this.count,
    };
  }

  dispose() {
    super.dispose();
    if (this.beat) clearTimeout(this.beat);
    this.beat = null;
  }

  protected dispatch(p: Player, msg: BlackjackMessage): string | null {
    switch (msg.type) {
      case "sit": return this.sit(p, msg.seat);
      case "bet": return this.bet(p, msg.amount);
      case "action": return this.act(p, msg.action);
      case "start": return this.start(p);
      case "newRound": return this.newRound(p);
    }
  }

  private seatIndex(p: Player): number {
    return p.slot === null ? -1 : this.table.seats.findIndex(s => s.id === seatId(p.slot!));
  }

  private absent(seat: Seat): boolean {
    const owner = this.ownerOf(slotOf(seat));
    return !owner || owner.away;
  }

  protected release(p: Player) {
    if (p.slot !== null) this.unseat(p.slot);
  }

  /** Frees a slot. Mid-round its dealt seat stays on the table (auto-played) until the round ends. */
  private unseat(slot: number): Seat | undefined {
    const benched = this.bench.get(slot);
    this.bench.delete(slot);
    const seat = this.table.seats.find(s => s.id === seatId(slot));
    if (seat && this.table.phase === "betting") {
      this.table = { ...this.table, seats: this.table.seats.filter(s => s !== seat) };
    }
    return benched ?? seat;
  }

  private sit(p: Player, slot: number): string | null {
    if (p.slot === slot) return null;
    const inRound = this.table.phase !== "betting";
    if (this.ownerOf(slot) || (inRound && this.table.seats.some(s => s.id === seatId(slot)))) return "seat taken";
    if (p.slot !== null && inRound) return "change seats between rounds";
    const old = p.slot === null ? undefined : this.unseat(p.slot);
    const seat = createSeat(seatId(slot), p.name, old?.bankroll ?? STARTING_BANKROLL);
    p.slot = slot;
    if (inRound) this.bench.set(slot, seat);
    else this.table = { ...this.table, seats: [...this.table.seats, seat].sort(bySlot) };
    return null;
  }

  private bet(p: Player, amount: number): string | null {
    const i = this.seatIndex(p);
    if (i < 0) return "sit down first";
    if (this.table.phase !== "betting") return "bets are closed";
    if (amount > this.table.seats[i].bankroll) return "not enough bankroll";
    this.table = placeBet(this.table, i, amount);
    return null;
  }

  private start(p: Player): string | null {
    if (!this.canDirect(p)) return "only the host can deal";
    if (this.table.phase !== "betting") return "round already in progress";
    if (!this.table.seats.some(s => s.pendingBet > 0)) return "nobody has bet yet";
    this.deal();
    return null;
  }

  /** Deals everyone with a wager down; the rest sit this round out on the bench. */
  private deal() {
    const t = this.table;
    for (const s of t.seats) if (s.pendingBet === 0) this.bench.set(slotOf(s), s);
    const reshuffling = needsReshuffle(t.deck.length, this.opts.deckCount);
    if (reshuffling) {
      this.counted.clear();
      this.count = { running: 0, justReshuffled: true };
    } else {
      this.count = { ...this.count, justReshuffled: false };
    }
    this.table = startRound({ ...t, seats: t.seats.filter(s => s.pendingBet > 0) }, this.opts.deckCount, this.opts.rng);
  }

  private newRound(p: Player): string | null {
    if (!this.canDirect(p)) return "only the host can start a new round";
    if (this.table.phase !== "result") return "the round isn't over";
    const reset = resetRound(this.table);
    const kept = reset.seats.filter(s => this.ownerOf(slotOf(s)) && !this.bench.has(slotOf(s)));
    this.table = { ...reset, seats: [...kept, ...this.bench.values()].sort(bySlot) };
    this.bench.clear();
    return null;
  }

  private act(p: Player, move: Move): string | null {
    const i = this.seatIndex(p);
    if (i < 0) return "you aren't in this round";
    const t = this.table;
    const insure = INSURANCE_MOVES[move];
    let next = t;
    if (move === "buyBackIn") {
      const between = t.phase === "betting" || t.phase === "result";
      if (!between || t.seats[i].bankroll >= MIN_CHIP) return "buy-back is only for a broke seat between rounds";
      next = resetSeatBankroll(t, i);
    } else if (insure) {
      if (t.phase !== "insurance") return "insurance isn't on offer";
      next = insure(t, i);
    } else {
      if (t.phase !== "playerTurns" || t.activeSeatIndex !== i) return "not your turn";
      if (pendingDealHandId(t)) return "wait for the deal";
      next = PLAY_MOVES[move]!(t, this.opts);
    }
    if (next === t) return `can't ${move} now`;
    this.table = next;
    return null;
  }

  /** Decides for seats whose player left or went away, so one absence never stalls the table. */
  private autoPlay() {
    for (;;) {
      const t = this.table;
      let next = t;
      if (t.phase === "insurance") {
        const i = t.seats.findIndex(s => s.insurance === null && this.absent(s));
        if (i >= 0) next = declineInsurance(t, i);
      } else if (t.phase === "playerTurns" && !pendingDealHandId(t)) {
        const seat = t.seats[t.activeSeatIndex];
        if (seat && this.absent(seat)) next = stand(t);
      }
      if (next === t) return;
      this.table = next;
    }
  }

  /** Arms the single beat timer when the table is waiting on a dealt card, not on a player. */
  private schedule() {
    if (this.beat) return;
    const t = this.table;
    if (t.phase === "dealerTurn") this.settled ??= finishDealerAndSettle(t, this.opts.rng);
    else if (!pendingDealHandId(t)) return;
    this.beat = setTimeout(() => {
      this.beat = null;
      this.tick();
      this.afterChange();
    }, this.opts.beatMs);
  }

  // The dealer's full hand is decided up front but kept off `table` so snapshots only show drawn cards.
  private tick() {
    const t = this.table;
    if (t.phase === "dealerTurn" && this.settled) {
      const nextCard = this.settled.dealerHand[t.dealerHand.length];
      if (nextCard) {
        this.table = { ...t, dealerHand: [...t.dealerHand, nextCard] };
      } else {
        this.table = this.settled;
        this.settled = null;
      }
    } else {
      this.table = dealSecondCardIfNeeded(t, this.opts.deckCount, this.opts.rng);
    }
  }

  private updateCount() {
    const t = this.table;
    const visible: Card[] = [...t.seats.flatMap(s => s.hands.flatMap(h => h.cards)), ...t.dealerHand].filter(c => c.faceUp);
    const fresh = visible.filter(c => !this.counted.has(c.id));
    if (fresh.length === 0) return;
    for (const c of fresh) this.counted.add(c.id);
    const last = fresh[fresh.length - 1];
    this.count = {
      ...this.count,
      running: this.count.running + fresh.reduce((sum, c) => sum + hiLoValue(c.rank), 0),
      lastCard: { card: last, delta: hiLoValue(last.rank) },
    };
  }

  protected settle() {
    const t = this.table;
    // Same as single-player: the deal goes out once every seat has a wager down, whichever change got it there.
    if (t.phase === "betting" && t.seats.length > 0 && t.seats.every(s => s.pendingBet > 0)) this.deal();
    this.autoPlay();
    this.schedule();
    this.updateCount();
  }
}
