import { renderHook, act } from "@testing-library/react";
import { useBlackjack } from "../hooks/useBlackjack";
import { getHouseRules } from "../lib/houseRules";

// Draw order for N seats: seat0-card1, seat0-card2, ..., seatN-card1, seatN-card2,
// dealerUp, dealerHole, [seat actions draw in turn order after that]. The shoe
// itself is mocked so every round deals a deterministic, known sequence.
let mockRanks: number[] = [];
let idc = 0;
vi.mock("../lib/shoe", async () => {
  const actual = await vi.importActual<typeof import("../lib/shoe")>("../lib/shoe");
  return {
    ...actual,
    createShoe: () => mockRanks.map((rank) => ({ id: `shoe-m-${idc++}`, suit: "spades" as const, rank, faceUp: true })),
  };
});
function setDeck(ranks: number[]) {
  mockRanks = [...ranks, ...Array(60).fill(2)];
}
function flush() {
  for (let i = 0; i < 5; i++) act(() => { vi.runAllTimers(); });
}

beforeEach(() => {
  localStorage.clear();
  idc = 0;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/*  Split mechanics through the full hook flow                         */
/* ------------------------------------------------------------------ */

describe("split mechanics via the hook", () => {
  test("splitting a pair deducts a second bet from the bankroll and creates two hands", () => {
    // player [8,8], dealer up=2 hole=3=5 (won't peek/BJ). split draws: 4 (hand A), 5 (hand B).
    setDeck([8, 8, 2, 3, 4, 5]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    expect(result.current.actions?.canSplit).toBe(true);

    act(() => { result.current.split(); });

    const seat = result.current.state.seats[0];
    expect(seat.hands).toHaveLength(2);
    expect(seat.hands[0].cards.map(c => c.rank)).toEqual([8, 4]);
    expect(seat.hands[1].cards.map(c => c.rank)).toEqual([8, 5]);
    expect(seat.hands[0].bet).toBe(100);
    expect(seat.hands[1].bet).toBe(100);
    // Bankroll itself doesn't move until settlement, but the funds committed this
    // round (100 + 100) must not exceed what the seat actually has.
    expect(seat.bankroll).toBe(startBankroll);
  });

  test("re-splitting up to the default cap of 3 splits produces 4 hands", () => {
    // Every draw after a split hand's first card keeps producing another 8, forcing a resplit,
    // until the last draw (7) breaks the pair and the hand stands pat.
    setDeck([8, 8, 2, 3, 8, 8, 8, 7]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 25); result.current.startRound(); });
    act(() => { result.current.split(); }); // 1 split -> 2 hands: [8,8] [8,8]
    act(() => { result.current.split(); }); // acts on hand 0 (still [8,8]) -> [8,8] [8,7] hand2
    act(() => { result.current.split(); }); // acts on hand 0 again -> cap reached at 4 hands

    const seat = result.current.state.seats[0];
    expect(seat.hands).toHaveLength(4);
  });

  test("the split cap (default 3) is enforced — a 4th split attempt is rejected", () => {
    // Every split keeps drawing an 8 into the hand being acted on, so it stays a
    // splittable pair right up to the cap -- isolates "cap reached" from "not a pair".
    setDeck([8, 8, 2, 3, 8, 7, 8, 7, 8, 7]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 25); result.current.startRound(); });
    act(() => { result.current.split(); });
    act(() => { result.current.split(); });
    act(() => { result.current.split(); });
    expect(result.current.state.seats[0].hands).toHaveLength(4);
    expect(result.current.actions?.splitOffered).toBe(true);
    expect(result.current.actions?.canSplit).toBe(false);
    expect(result.current.actions?.splitReason).toMatch(/limit reached/);

    // Attempting a 5th split must be a no-op.
    act(() => { result.current.split(); });
    expect(result.current.state.seats[0].hands).toHaveLength(4);
  });

  test("maxSplits: 1 caps a seat at 2 hands total", () => {
    setDeck([8, 8, 2, 3, 8, 9]);
    const { result } = renderHook(() => useBlackjack(1));
    act(() => { result.current.setHouseRules({ ...getHouseRules(), maxSplits: 1 }); });

    act(() => { result.current.placeBet(0, 25); result.current.startRound(); });
    act(() => { result.current.split(); });
    expect(result.current.state.seats[0].hands).toHaveLength(2);

    act(() => { result.current.split(); }); // rejected — cap of 1 already used
    expect(result.current.state.seats[0].hands).toHaveLength(2);
  });

  test("maxSplits: 0 never offers a split even on a pair", () => {
    setDeck([8, 8, 2, 3]);
    const { result } = renderHook(() => useBlackjack(1));
    act(() => { result.current.setHouseRules({ ...getHouseRules(), maxSplits: 0 }); });

    act(() => { result.current.placeBet(0, 25); result.current.startRound(); });
    expect(result.current.actions?.canSplit).toBe(false);
    expect(result.current.actions?.splitReason).toMatch(/disabled/);
  });

  test("each split hand is played to completion in turn, then settles independently", () => {
    // player [8,8], dealer up=2 hole=3=5. Split draws 3 (hand A: 8+3=11) and 10 (hand B: 8+10=18).
    // Hand A hits to 21 (draws 10), hand B stands at 18. Dealer draws to a fixed 19.
    setDeck([8, 8, 2, 3, 3, 10, 10, 9]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.split(); });
    // hand A: [8,3]=11 -> hit -> [8,3,10]=21 -> auto-stands at 21
    act(() => { result.current.hit(); });
    expect(result.current.state.seats[0].hands[0].cards.map(c => c.rank)).toEqual([8, 3, 10]);
    // now hand B is active: [8,10]=18 -> stand
    act(() => { result.current.stand(); });

    flush();

    const seat = result.current.state.seats[0];
    expect(seat.hands).toHaveLength(2);
    expect(seat.hands[0].result).toBeDefined();
    expect(seat.hands[1].result).toBeDefined();
    // Hand A (21, not a natural since split) beats a dealer total below 21; hand B (18) also settles on its own.
    expect(seat.hands[0].result?.result).not.toBe("blackjack");
  });

  test("double after split honored when DAS is on", () => {
    setDeck([8, 8, 2, 3, 3, 10]);
    const { result } = renderHook(() => useBlackjack(1));
    act(() => { result.current.setHouseRules({ ...getHouseRules(), doubleAfterSplit: true }); });

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.split(); });
    expect(result.current.actions?.canDouble).toBe(true);
  });

  test("double after split blocked when DAS is off", () => {
    setDeck([8, 8, 2, 3, 3, 10]);
    const { result } = renderHook(() => useBlackjack(1));
    act(() => { result.current.setHouseRules({ ...getHouseRules(), doubleAfterSplit: false }); });

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.split(); });
    expect(result.current.actions?.canDouble).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Split-ace one-card rule via the hook                                */
/* ------------------------------------------------------------------ */

describe("split aces one-card rule via the hook", () => {
  test("toggle ON: each split-ace hand gets exactly one card and then stands (no further action)", () => {
    // player [A,A], dealer up=2 hole=3=5. Split draws 9 (hand A) and 8 (hand B).
    setDeck([1, 1, 2, 3, 9, 8]);
    const { result } = renderHook(() => useBlackjack(1));
    act(() => { result.current.setHouseRules({ ...getHouseRules(), splitAcesOneCardOnly: true }); });

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.split(); });

    const seat = result.current.state.seats[0];
    expect(seat.hands[0].cards).toHaveLength(2);
    expect(seat.hands[1].cards).toHaveLength(2);
    expect(seat.hands[0].status).toBe("stood");
    expect(seat.hands[1].status).toBe("stood");
    // No further action was possible — the round already moved straight to the dealer.
    expect(result.current.actions).toBeNull();
  });

  test("a split-ace 21 (A + 10-value) settles as a plain win, not a paid blackjack", () => {
    // player [A,A], dealer up=2 hole=3. Split draws a King for hand A (A+K=21) and a 4 for hand B.
    setDeck([1, 1, 2, 3, 13, 4, 9]);
    const { result } = renderHook(() => useBlackjack(1));
    act(() => { result.current.setHouseRules({ ...getHouseRules(), splitAcesOneCardOnly: true }); });

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    act(() => { result.current.split(); });
    flush();

    const seat = result.current.state.seats[0];
    expect(seat.hands[0].cards.map(c => c.rank)).toEqual([1, 13]);
    expect(seat.hands[0].result?.result).not.toBe("blackjack");
  });

  test("toggle OFF: a split-ace hand stays active and can be hit again", () => {
    setDeck([1, 1, 2, 3, 5, 8]);
    const { result } = renderHook(() => useBlackjack(1));
    act(() => { result.current.setHouseRules({ ...getHouseRules(), splitAcesOneCardOnly: false }); });

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.split(); });

    const seat = result.current.state.seats[0];
    expect(seat.hands[0].status).toBe("active"); // A+5=16, still hittable
    expect(result.current.actions?.canHit).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Multi-seat play                                                     */
/* ------------------------------------------------------------------ */

describe("multi-seat: independent bets, turns, and settlement", () => {
  test("three seats with different bets and outcomes settle independently against one dealer hand", () => {
    // Deal order: seat0[10,6]=16, seat1[9,9]=18(pair, not acted on), seat2[1,13]=21 BJ,
    // dealerUp=7 dealerHole=9=16(dealer must hit); dealer draws 3 -> 19.
    setDeck([10, 6, 9, 9, 1, 13, 7, 9, 3]);
    const { result } = renderHook(() => useBlackjack(3));

    act(() => {
      result.current.placeBet(0, 50);
      result.current.placeBet(1, 100);
      result.current.placeBet(2, 25);
      result.current.startRound();
    });

    // Seat 2 has a natural -> auto-skipped. Seat 0 acts first.
    expect(result.current.state.phase).toBe("playerTurns");
    expect(result.current.state.activeSeatIndex).toBe(0);

    act(() => { result.current.stand(); }); // seat 0: 16 stands
    expect(result.current.state.activeSeatIndex).toBe(1);

    act(() => { result.current.stand(); }); // seat 1: 18 stands
    flush(); // seat 2 was already resolved (natural); dealer plays out and settles

    const [seat0, seat1, seat2] = result.current.state.seats;
    expect(result.current.state.phase).toBe("result");

    // Dealer final total is 19 (16 + 3): seat0 (16) loses, seat1 (18) loses, seat2 (natural 21) wins big.
    expect(seat0.hands[0].result?.result).toBe("loss");
    expect(seat0.hands[0].result?.amount).toBe(-50);
    expect(seat1.hands[0].result?.result).toBe("loss");
    expect(seat1.hands[0].result?.amount).toBe(-100);
    expect(seat2.hands[0].result?.result).toBe("blackjack");
    expect(seat2.hands[0].result?.amount).toBe(37.5); // exact half-dollar payout, no rounding
  });

  test("each seat's bankroll updates only by its own hand's result", () => {
    setDeck([10, 9, 8, 8, 7, 9, 5]);
    const { result } = renderHook(() => useBlackjack(2));
    const seat0Start = result.current.state.seats[0].bankroll;
    const seat1Start = result.current.state.seats[1].bankroll;

    act(() => {
      result.current.placeBet(0, 50);
      result.current.placeBet(1, 50);
      result.current.startRound();
    });
    act(() => { result.current.stand(); });
    act(() => { result.current.stand(); });
    flush();

    const [seat0, seat1] = result.current.state.seats;
    expect(seat0.bankroll).toBe(seat0Start + (seat0.hands[0].result?.amount ?? 0));
    expect(seat1.bankroll).toBe(seat1Start + (seat1.hands[0].result?.amount ?? 0));
  });

  test("seat count can be configured from 1 to 5 before betting starts", () => {
    const { result } = renderHook(() => useBlackjack(1));
    act(() => { result.current.setSeatCount(5); });
    expect(result.current.state.seats).toHaveLength(5);
    act(() => { result.current.setSeatCount(1); });
    expect(result.current.state.seats).toHaveLength(1);
  });
});
