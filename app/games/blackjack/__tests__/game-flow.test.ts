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

function flush() {
  act(() => { vi.runAllTimers(); });
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

  test("hit then stand resolves to a result phase with bankroll updated", () => {
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

    expect(result.current.state?.phase).toBe("result");
    expect(result.current.state?.result?.result).toBe("loss");
    expect(result.current.state?.result?.amount).toBe(-50);
    expect(result.current.state?.bankroll).toBe(startBankroll - 50);
    expect(result.current.state?.dealerHand.every((c: Card) => c.faceUp)).toBe(true);
  });
});

describe("instant-blackjack branches on deal", () => {
  test("player blackjack, dealer not → resolves immediately as a blackjack win", () => {
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

  test("dealer blackjack, player not → resolves immediately as a loss", () => {
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
