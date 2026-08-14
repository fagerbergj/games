import { renderHook, act } from "@testing-library/react";
import { useBlackjack } from "../hooks/useBlackjack";
import type { Card } from "../lib/types";

// Deterministic control over what a fresh shoe contains, same technique
// game-flow.test.ts uses for createShoe — lets us force specific hand
// outcomes and specific shoe sizes relative to the penetration threshold.
let mockRanks: number[] = [];
let idc = 0;

vi.mock("../lib/shoe", async () => {
  const actual = await vi.importActual<typeof import("../lib/shoe")>("../lib/shoe");
  return {
    ...actual,
    createShoe: () => mockRanks.map((rank) => ({ id: `shoe-m-${idc++}`, suit: "spades" as const, rank, faceUp: true })),
  };
});

function setShoeRanks(ranks: number[]) {
  mockRanks = ranks;
}

function flush() {
  for (let i = 0; i < 5; i++) act(() => { vi.runAllTimers(); });
}

function handIds(cards: readonly Card[]): string[] {
  return cards.map((c) => c.id);
}

beforeEach(() => {
  localStorage.clear();
  idc = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("shoe continuity across hands", () => {
  test("hand 2 draws cards distinct from hand 1 — the shoe is not rebuilt between hands", () => {
    // 40 low cards: two short hands (~7 cards each with an all-4s deck) stay
    // well above the 13-card (25% of 52) reshuffle floor for deckCount=1.
    setShoeRanks(Array(40).fill(4));
    const { result } = renderHook(() => useBlackjack());
    act(() => { result.current.setDeckCount(1); });

    act(() => { result.current.placeBet(10); });
    flush();
    act(() => { result.current.stand(); });
    flush();
    expect(result.current.state?.phase).toBe("result");
    const hand1Ids = new Set([
      ...handIds(result.current.state!.playerHand),
      ...handIds(result.current.state!.dealerHand),
    ]);

    act(() => { result.current.resetGame(); });
    expect(result.current.justReshuffled).toBe(false); // still enough shoe left from setDeckCount's rebuild

    act(() => { result.current.placeBet(10); });
    flush();
    expect(result.current.justReshuffled).toBe(false);
    const hand2Ids = [
      ...handIds(result.current.state!.playerHand),
      ...handIds(result.current.state!.dealerHand),
    ];

    for (const id of hand2Ids) {
      expect(hand1Ids.has(id)).toBe(false);
    }
  });

  test("decks remaining shrinks hand over hand instead of resetting", () => {
    setShoeRanks(Array(300).fill(4));
    const { result } = renderHook(() => useBlackjack());
    act(() => { result.current.setDeckCount(6); });
    const initial = result.current.decksRemaining;

    act(() => { result.current.placeBet(10); });
    flush();
    act(() => { result.current.stand(); });
    flush();
    const afterHand1 = result.current.decksRemaining;
    expect(afterHand1).toBeLessThan(initial);

    act(() => { result.current.resetGame(); });
    act(() => { result.current.placeBet(10); });
    flush();
    act(() => { result.current.stand(); });
    flush();
    const afterHand2 = result.current.decksRemaining;
    expect(afterHand2).toBeLessThan(afterHand1);
  });

  test("reshuffle is only ever checked at the next placeBet, never mid-hand", () => {
    // 18 cards, deckCount=1 (threshold at 13): dealing + a few hits pushes the
    // live remaining count below the threshold WHILE the hand is still open.
    setShoeRanks(Array(18).fill(4));
    const { result } = renderHook(() => useBlackjack());
    act(() => { result.current.setDeckCount(1); });

    act(() => { result.current.placeBet(10); });
    flush();
    expect(result.current.justReshuffled).toBe(false);

    // Player: 4,4=8 → hit,hit,hit → 12,16,20 (never busts, stays playerTurn).
    for (let i = 0; i < 3; i++) {
      act(() => { result.current.hit(); });
      flush();
      expect(result.current.state?.phase).toBe("playerTurn");
    }

    act(() => { result.current.stand(); });
    flush();
    expect(result.current.state?.phase).toBe("result"); // resolving the hand isn't a reshuffle point either

    act(() => { result.current.resetGame(); });
    expect(result.current.justReshuffled).toBe(false); // still not checked — only placeBet checks

    setShoeRanks(Array(60).fill(4)); // what the reshuffle will actually build
    act(() => { result.current.placeBet(10); });
    expect(result.current.justReshuffled).toBe(true); // now, at the hand boundary, it fires
  });

  test("running count carries across hands and resets to exactly 0 at reshuffle", () => {
    // 18 rank-4 cards (each Hi-Lo +1), deckCount=1 → hand1 leaves too little for hand2 (<13 → reshuffle next hand).
    setShoeRanks(Array(18).fill(4));
    const { result } = renderHook(() => useBlackjack());
    act(() => { result.current.setDeckCount(1); });

    act(() => { result.current.placeBet(10); });
    flush();
    act(() => { result.current.stand(); });
    flush();
    expect(result.current.state?.phase).toBe("result");
    const hand1Count = result.current.runningCount;
    expect(hand1Count).toBeGreaterThan(0);

    act(() => { result.current.resetGame(); });
    setShoeRanks(Array(60).fill(4));
    act(() => { result.current.placeBet(10); });

    // Reset fires synchronously with the reshuffle trigger, and the counting
    // effect immediately re-tallies the freshly-dealt cards in the same act()
    // -- so what's observable here is "hand 2's own count", not a bare 0 and
    // not hand 1's count carried forward (3 visible new-shoe cards: two
    // player + one dealer up-card, each a rank-4 Hi-Lo +1).
    expect(result.current.justReshuffled).toBe(true);
    expect(result.current.runningCount).toBe(3);
    expect(result.current.runningCount).not.toBe(hand1Count);

    flush();
    expect(result.current.state?.phase).toBe("playerTurn");
  });
});
