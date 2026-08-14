import { renderHook, act } from "@testing-library/react";
import { useBlackjack } from "../hooks/useBlackjack";
import type { Card } from "../lib/types";

// placeBet deals in draw order: player1, dealerUp, player2, dealerHole.
// Stubbing shuffledDeck to a fixed rank sequence makes every hand deterministic.
let mockRanks: number[] = [];

vi.mock("../lib/engine", async () => {
  const actual = await vi.importActual<typeof import("../lib/engine")>("../lib/engine");
  return {
    ...actual,
    shuffledDeck: () => mockRanks.map((rank, i) => ({ id: `m-${i}`, suit: "spades" as const, rank, faceUp: true })),
  };
});

// Pads a scenario's prescribed ranks with harmless low-value filler cards
// so dealer/hit draws never run off the end of the mocked deck.
function setDeck(ranks: number[]) {
  mockRanks = [...ranks, ...Array(20).fill(2)];
}

// A hand can reach "result" through more than one hop of setTimeout(0) → a
// React effect scheduling its own timers, so drain the timer queue a few
// times rather than once.
function flush() {
  for (let i = 0; i < 5; i++) act(() => { vi.runAllTimers(); });
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("full hand: bet → deal → hit → stand → result", () => {
  test("deal transitions out of betting into playerTurn with two player cards and one visible dealer card", () => {
    // player [8,4]=12, dealer up=7 hole=5 → neither side blackjack.
    setDeck([8, 7, 4, 5]);
    const { result } = renderHook(() => useBlackjack());

    act(() => { result.current.placeBet(50); });
    flush();

    expect(result.current.state?.phase).toBe("playerTurn");
    expect(result.current.state?.playerHand).toHaveLength(2);
    expect(result.current.state?.dealerHand).toHaveLength(2);
    const visibleDealerCards = result.current.state?.dealerHand.filter((c: Card) => c.faceUp);
    expect(visibleDealerCards).toHaveLength(1);
  });

  test("stand enters dealerTurn immediately, then resolves to result once the reveal finishes", () => {
    // Deal: player [8,4]=12, dealer [7,5]=12. Hit draws 5 → player 17.
    // Stand: dealer draws 9 → dealer 21, beats player's 17 → loss.
    setDeck([8, 7, 4, 5, 5, 9]);
    const { result } = renderHook(() => useBlackjack());
    const startBankroll = result.current.state!.bankroll;

    act(() => { result.current.placeBet(50); });
    flush();
    expect(result.current.state?.phase).toBe("playerTurn");

    act(() => { result.current.hit(); });
    flush();
    expect(result.current.state?.phase).toBe("playerTurn");
    expect(result.current.state?.playerHand).toHaveLength(3);

    act(() => { result.current.stand(); });
    // stand() flips the hole card and hands off to the dealer's turn on the spot —
    // it must NOT jump straight to "result" (that's the whole point of item 7).
    expect(result.current.state?.phase).toBe("dealerTurn");
    expect(result.current.state?.dealerHand.every((c: Card) => c.faceUp)).toBe(true);

    flush();

    expect(result.current.state?.phase).toBe("result");
    expect(result.current.state?.result?.result).toBe("loss");
    expect(result.current.state?.result?.amount).toBe(-50);
    expect(result.current.state?.bankroll).toBe(startBankroll - 50);
    expect(result.current.state?.dealerHand.every((c: Card) => c.faceUp)).toBe(true);
  });
});

describe("dealer reveal is paced, not instantaneous (item 7)", () => {
  test("the dealer's extra card lands only after its own timer, one at a time", () => {
    // Deal: player [8,4]=12, dealer [7,5]=12. Hit draws 5 → player 17.
    // Stand: dealer needs exactly one more card (9) to reach 21.
    setDeck([8, 7, 4, 5, 5, 9]);
    const { result } = renderHook(() => useBlackjack());

    act(() => { result.current.placeBet(50); });
    flush();
    act(() => { result.current.hit(); });
    flush();

    act(() => { result.current.stand(); });
    expect(result.current.state?.dealerHand).toHaveLength(2); // hole flipped, no extra card yet
    expect(result.current.state?.phase).toBe("dealerTurn");

    act(() => { vi.advanceTimersByTime(599); });
    expect(result.current.state?.dealerHand).toHaveLength(2); // still not landed
    expect(result.current.state?.phase).toBe("dealerTurn");

    act(() => { vi.advanceTimersByTime(1); }); // crosses the 600ms mark
    expect(result.current.state?.dealerHand).toHaveLength(3); // card landed...
    expect(result.current.state?.phase).toBe("dealerTurn"); // ...but not resolved yet

    act(() => { vi.advanceTimersByTime(600); }); // the finalize tick
    expect(result.current.state?.phase).toBe("result");
  });

  test("a multi-card dealer draw reveals each card on its own tick", () => {
    // Dealer [up=2, hole=3]=5 must draw repeatedly: 4→9, 4→13, 4→17 (stands).
    setDeck([10, 2, 6, 3, 4, 4, 4]);
    const { result } = renderHook(() => useBlackjack());

    act(() => { result.current.placeBet(50); });
    flush();
    act(() => { result.current.stand(); });

    expect(result.current.state?.dealerHand).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.state?.dealerHand).toHaveLength(3);
    expect(result.current.state?.phase).toBe("dealerTurn");
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.state?.dealerHand).toHaveLength(4);
    expect(result.current.state?.phase).toBe("dealerTurn");
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.state?.dealerHand).toHaveLength(5);
    expect(result.current.state?.phase).toBe("dealerTurn"); // landed, not yet finalized
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.state?.phase).toBe("result");
  });
});

describe("cancel-safety of the dealer reveal (item 7)", () => {
  test("starting a new hand mid-reveal cancels the old hand's pending timers", () => {
    setDeck([8, 7, 4, 5, 5, 9]);
    const { result } = renderHook(() => useBlackjack());

    act(() => { result.current.placeBet(50); });
    flush();
    act(() => { result.current.hit(); });
    flush();
    const bankrollBeforeStand = result.current.state!.bankroll;

    act(() => { result.current.stand(); });
    act(() => { vi.advanceTimersByTime(300); }); // mid-reveal, before the dealer's extra card lands
    act(() => { result.current.resetGame(); });

    // Any timers the superseded hand left behind must be inert.
    act(() => { vi.runAllTimers(); });

    expect(result.current.state?.phase).toBe("betting");
    expect(result.current.state?.bankroll).toBe(bankrollBeforeStand);
    expect(result.current.state?.dealerHand).toHaveLength(0);
  });

  test("unmounting mid-reveal does not throw or leave a dangling timer", () => {
    setDeck([8, 7, 4, 5, 5, 9]);
    const { result, unmount } = renderHook(() => useBlackjack());

    act(() => { result.current.placeBet(50); });
    flush();
    act(() => { result.current.hit(); });
    flush();
    act(() => { result.current.stand(); });
    act(() => { vi.advanceTimersByTime(300); });

    expect(() => unmount()).not.toThrow();
    expect(() => act(() => { vi.runAllTimers(); })).not.toThrow();
  });

  test("the hand always reaches result eventually — reveal is never left stranded", () => {
    setDeck([8, 7, 4, 5, 5, 9]);
    const { result } = renderHook(() => useBlackjack());

    act(() => { result.current.placeBet(50); });
    flush();
    act(() => { result.current.hit(); });
    flush();
    act(() => { result.current.stand(); });

    flush(); // drains every scheduled reveal tick, however many there are
    expect(result.current.state?.phase).toBe("result");
    expect(result.current.state?.result).not.toBeUndefined();
  });
});

describe("instant-blackjack branches on deal", () => {
  test("player blackjack, dealer not → resolves to a blackjack win once the reveal settles", () => {
    // player [A,K]=21 BJ. dealer [10,7]=17 (no BJ, no further draw).
    setDeck([1, 10, 13, 7]);
    const { result } = renderHook(() => useBlackjack());
    const startBankroll = result.current.state!.bankroll;

    act(() => { result.current.placeBet(100); });
    flush();

    expect(result.current.state?.phase).toBe("result");
    expect(result.current.state?.result?.result).toBe("blackjack");
    expect(result.current.state?.result?.amount).toBe(150);
    expect(result.current.state?.bankroll).toBe(startBankroll + 150);
    expect(result.current.state?.dealerHand.every((c: Card) => c.faceUp)).toBe(true);
  });

  test("dealer blackjack, player not → resolves to a loss once the reveal settles", () => {
    // player [10,6]=16 (no BJ). dealer [A,K]=21 BJ.
    setDeck([10, 1, 6, 13]);
    const { result } = renderHook(() => useBlackjack());
    const startBankroll = result.current.state!.bankroll;

    act(() => { result.current.placeBet(100); });
    flush();

    expect(result.current.state?.phase).toBe("result");
    expect(result.current.state?.result?.result).toBe("loss");
    expect(result.current.state?.result?.amount).toBe(-100);
    expect(result.current.state?.bankroll).toBe(startBankroll - 100);
    expect(result.current.state?.dealerHand.every((c: Card) => c.faceUp)).toBe(true);
  });

  test("both blackjack → push, bankroll unchanged", () => {
    // player [A,K]=21 BJ. dealer [A,Q]=21 BJ.
    setDeck([1, 1, 13, 12]);
    const { result } = renderHook(() => useBlackjack());
    const startBankroll = result.current.state!.bankroll;

    act(() => { result.current.placeBet(100); });
    flush();

    expect(result.current.state?.phase).toBe("result");
    expect(result.current.state?.result?.result).toBe("push");
    expect(result.current.state?.result?.amount).toBe(0);
    expect(result.current.state?.bankroll).toBe(startBankroll);
  });
});

describe("bust on hit", () => {
  test("hitting past 21 resolves immediately as a loss without waiting on dealer", () => {
    // Deal: player [10,6]=16, dealer [7,9]=16. Hit draws 10 → player 26, bust.
    setDeck([10, 7, 6, 9, 10]);
    const { result } = renderHook(() => useBlackjack());
    const startBankroll = result.current.state!.bankroll;

    act(() => { result.current.placeBet(50); });
    flush();

    act(() => { result.current.hit(); });
    flush();

    expect(result.current.state?.phase).toBe("result");
    expect(result.current.state?.result?.result).toBe("loss");
    expect(result.current.state?.result?.amount).toBe(-50);
    expect(result.current.state?.bankroll).toBe(startBankroll - 50);
    expect(result.current.state?.playerHand).toHaveLength(3);
    expect(result.current.state?.dealerHand.every((c: Card) => c.faceUp)).toBe(true);
  });
});

describe("resetGame", () => {
  test("preserves the current bankroll instead of resetting to the default", () => {
    setDeck([1, 10, 13, 7]); // player blackjack → fast path to a result
    const { result } = renderHook(() => useBlackjack());

    act(() => { result.current.placeBet(100); });
    flush();
    const wonBankroll = result.current.state!.bankroll;
    expect(wonBankroll).not.toBe(500);

    act(() => { result.current.resetGame(); });

    expect(result.current.state).not.toBeNull();
    expect(result.current.state?.phase).toBe("betting");
    expect(result.current.state?.bankroll).toBe(wonBankroll);
  });

  test("a hand can be played again after resetGame (state is never left unrecoverable)", () => {
    setDeck([1, 10, 13, 7]);
    const { result } = renderHook(() => useBlackjack());

    act(() => { result.current.placeBet(100); });
    flush();
    act(() => { result.current.resetGame(); });

    setDeck([8, 7, 4, 5]);
    act(() => { result.current.placeBet(50); });
    flush();

    expect(result.current.state?.phase).toBe("playerTurn");
    expect(result.current.state?.playerHand).toHaveLength(2);
  });
});

describe("placeBet guard against stray calls", () => {
  test("calling placeBet again mid-hand leaves state untouched instead of wiping it", () => {
    setDeck([8, 7, 4, 5]);
    const { result } = renderHook(() => useBlackjack());

    act(() => { result.current.placeBet(50); });
    flush();
    const midHandState = result.current.state;
    expect(midHandState?.phase).toBe("playerTurn");

    act(() => { result.current.placeBet(999); });

    expect(result.current.state).not.toBeNull();
    expect(result.current.state?.bankroll).toBe(midHandState?.bankroll);
    expect(result.current.state?.phase).toBe("playerTurn");
  });
});
