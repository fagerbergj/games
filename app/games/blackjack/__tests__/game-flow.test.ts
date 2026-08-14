import { renderHook, act } from "@testing-library/react";
import { useBlackjack } from "../hooks/useBlackjack";
import type { Card } from "../lib/types";

// placeBet(seatIndex, amount) then startRound() deals in draw order:
// seat0-card1, seat0-card2, ..., dealerUp, dealerHole. The shoe itself is mocked
// to a fixed rank sequence so every round is deterministic.
let mockRanks: number[] = [];
let idc = 0;

vi.mock("../lib/shoe", async () => {
  const actual = await vi.importActual<typeof import("../lib/shoe")>("../lib/shoe");
  return {
    ...actual,
    createShoe: () => mockRanks.map((rank) => ({ id: `shoe-m-${idc++}`, suit: "spades" as const, rank, faceUp: true })),
  };
});

// Pads a scenario's prescribed ranks with harmless low-value filler cards
// so dealer/hit draws never run off the end of the mocked deck.
function setDeck(ranks: number[]) {
  mockRanks = [...ranks, ...Array(20).fill(2)];
}

// A hand can reach "result" through more than one hop of setTimeout → a
// React effect scheduling its own timers, so drain the timer queue a few times.
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

describe("full hand: bet → deal → hit → stand → result (single seat)", () => {
  test("deal transitions out of betting into playerTurns with two player cards and one visible dealer card", () => {
    // player [8,4]=12, dealer up=7 hole=5 → neither side blackjack.
    setDeck([8, 4, 7, 5]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });

    expect(result.current.state.phase).toBe("playerTurns");
    expect(result.current.state.seats[0].hands[0].cards).toHaveLength(2);
    expect(result.current.state.dealerHand).toHaveLength(2);
    const visibleDealerCards = result.current.state.dealerHand.filter((c: Card) => c.faceUp);
    expect(visibleDealerCards).toHaveLength(1);
  });

  test("stand enters dealerTurn immediately, then resolves to result once the reveal finishes", () => {
    // Deal: player [8,4]=12, dealer [7,5]=12. Hit draws 5 → player 17.
    // Stand: dealer draws 9 → dealer 21, beats player's 17 → loss.
    setDeck([8, 4, 7, 5, 5, 9]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    expect(result.current.state.phase).toBe("playerTurns");

    act(() => { result.current.hit(); });
    expect(result.current.state.phase).toBe("playerTurns");
    expect(result.current.state.seats[0].hands[0].cards).toHaveLength(3);

    act(() => { result.current.stand(); });
    // stand() flips the hole card and hands off to the dealer's turn on the spot —
    // it must NOT jump straight to "result" (the reveal is paced).
    expect(result.current.state.phase).toBe("dealerTurn");
    expect(result.current.state.dealerHand.every((c: Card) => c.faceUp)).toBe(true);

    flush();

    expect(result.current.state.phase).toBe("result");
    const hand = result.current.state.seats[0].hands[0];
    expect(hand.result?.result).toBe("loss");
    expect(hand.result?.amount).toBe(-50);
    expect(result.current.state.seats[0].bankroll).toBe(startBankroll - 50);
    expect(result.current.state.dealerHand.every((c: Card) => c.faceUp)).toBe(true);
  });
});

describe("dealer reveal is paced, not instantaneous", () => {
  test("the dealer's extra card lands only after its own timer, one at a time", () => {
    setDeck([8, 4, 7, 5, 5, 9]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.hit(); });

    act(() => { result.current.stand(); });
    expect(result.current.state.dealerHand).toHaveLength(2); // hole flipped, no extra card yet
    expect(result.current.state.phase).toBe("dealerTurn");

    act(() => { vi.advanceTimersByTime(599); });
    expect(result.current.state.dealerHand).toHaveLength(2);
    expect(result.current.state.phase).toBe("dealerTurn");

    act(() => { vi.advanceTimersByTime(1); }); // crosses the 600ms mark
    expect(result.current.state.dealerHand).toHaveLength(3);
    expect(result.current.state.phase).toBe("dealerTurn"); // landed, not yet finalized

    act(() => { vi.advanceTimersByTime(600); }); // the finalize tick
    expect(result.current.state.phase).toBe("result");
  });

  test("a multi-card dealer draw reveals each card on its own tick", () => {
    // Dealer [up=2, hole=3]=5 must draw repeatedly: 4→9, 4→13, 4→17 (stands).
    setDeck([10, 6, 2, 3, 4, 4, 4]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.stand(); });

    expect(result.current.state.dealerHand).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.state.dealerHand).toHaveLength(3);
    expect(result.current.state.phase).toBe("dealerTurn");
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.state.dealerHand).toHaveLength(4);
    expect(result.current.state.phase).toBe("dealerTurn");
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.state.dealerHand).toHaveLength(5);
    expect(result.current.state.phase).toBe("dealerTurn"); // landed, not yet finalized
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.state.phase).toBe("result");
  });

  test("player natural blackjack: dealer never draws beyond its dealt two cards", () => {
    // player [A,K]=21 BJ, dealer up=9 hole=7=16 (not insurable, would normally hit).
    setDeck([1, 13, 9, 7]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    flush();

    expect(result.current.state.phase).toBe("result");
    expect(result.current.state.dealerHand).toHaveLength(2);
    expect(result.current.state.seats[0].hands[0].result?.result).toBe("blackjack");
  });

  test("player busts: dealer never draws beyond its dealt two cards", () => {
    // Deal: player [10,6]=16, dealer up=7 hole=9=16 (would normally hit). Hit draws 10 → bust.
    setDeck([10, 6, 7, 9, 10]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.hit(); });
    flush();

    expect(result.current.state.phase).toBe("result");
    expect(result.current.state.dealerHand).toHaveLength(2);
    expect(result.current.state.seats[0].hands[0].result?.result).toBe("loss");
  });
});

describe("cancel-safety of the dealer reveal", () => {
  test("starting a new round mid-reveal cancels the old round's pending timers", () => {
    setDeck([8, 4, 7, 5, 5, 9]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.hit(); });
    const bankrollBeforeStand = result.current.state.seats[0].bankroll;

    act(() => { result.current.stand(); });
    act(() => { vi.advanceTimersByTime(300); }); // mid-reveal, before the dealer's extra card lands
    act(() => { result.current.resetRound(); });

    // Any timers the superseded round left behind must be inert.
    act(() => { vi.runAllTimers(); });

    expect(result.current.state.phase).toBe("betting");
    expect(result.current.state.seats[0].bankroll).toBe(bankrollBeforeStand);
    expect(result.current.state.dealerHand).toHaveLength(0);
  });

  test("unmounting mid-reveal does not throw or leave a dangling timer", () => {
    setDeck([8, 4, 7, 5, 5, 9]);
    const { result, unmount } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.hit(); });
    act(() => { result.current.stand(); });
    act(() => { vi.advanceTimersByTime(300); });

    expect(() => unmount()).not.toThrow();
    expect(() => act(() => { vi.runAllTimers(); })).not.toThrow();
  });

  test("the hand always reaches result eventually — reveal is never left stranded", () => {
    setDeck([8, 4, 7, 5, 5, 9]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.hit(); });
    act(() => { result.current.stand(); });

    flush();
    expect(result.current.state.phase).toBe("result");
    expect(result.current.state.seats[0].hands[0].result).not.toBeUndefined();
  });
});

describe("instant-blackjack branches on deal", () => {
  test("player blackjack, dealer not → resolves to a blackjack win once the reveal settles", () => {
    // player [A,K]=21 BJ. dealer [9,7]=16 (no BJ, not insurable up card).
    setDeck([1, 13, 9, 7]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    flush();

    expect(result.current.state.phase).toBe("result");
    const hand = result.current.state.seats[0].hands[0];
    expect(hand.result?.result).toBe("blackjack");
    expect(hand.result?.amount).toBe(150);
    expect(result.current.state.seats[0].bankroll).toBe(startBankroll + 150);
    expect(result.current.state.dealerHand.every((c: Card) => c.faceUp)).toBe(true);
  });

  test("dealer blackjack (peeked), player not → resolves to a loss before the player ever acts", () => {
    // player [10,6]=16 (no BJ). dealer [K,A]=21 BJ, ten up card so insurance never triggers.
    setDeck([10, 6, 13, 1]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    flush();

    expect(result.current.state.phase).toBe("result");
    const hand = result.current.state.seats[0].hands[0];
    expect(hand.result?.result).toBe("loss");
    expect(hand.result?.amount).toBe(-100);
    expect(result.current.state.seats[0].bankroll).toBe(startBankroll - 100);
    expect(result.current.state.dealerHand.every((c: Card) => c.faceUp)).toBe(true);
  });

  test("both blackjack → push, bankroll unchanged", () => {
    // player [A,K]=21 BJ. dealer [K,A]=21 BJ, ten up card so insurance never triggers.
    setDeck([1, 13, 13, 1]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    flush();

    expect(result.current.state.phase).toBe("result");
    const hand = result.current.state.seats[0].hands[0];
    expect(hand.result?.result).toBe("push");
    expect(hand.result?.amount).toBe(0);
    expect(result.current.state.seats[0].bankroll).toBe(startBankroll);
  });
});

describe("bust on hit", () => {
  test("hitting past 21 resolves to a loss without the dealer needing to draw", () => {
    setDeck([10, 6, 7, 9, 10]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    act(() => { result.current.hit(); });
    flush();

    expect(result.current.state.phase).toBe("result");
    const hand = result.current.state.seats[0].hands[0];
    expect(hand.result?.result).toBe("loss");
    expect(hand.result?.amount).toBe(-50);
    expect(result.current.state.seats[0].bankroll).toBe(startBankroll - 50);
    expect(hand.cards).toHaveLength(3);
    expect(result.current.state.dealerHand.every((c: Card) => c.faceUp)).toBe(true);
  });
});

describe("resetRound", () => {
  test("preserves the current bankroll instead of resetting to the default", () => {
    setDeck([1, 13, 9, 7]); // player blackjack → fast path to a result
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    flush();
    const wonBankroll = result.current.state.seats[0].bankroll;
    expect(wonBankroll).not.toBe(500);

    act(() => { result.current.resetRound(); });

    expect(result.current.state.phase).toBe("betting");
    expect(result.current.state.seats[0].bankroll).toBe(wonBankroll);
  });

  test("a hand can be played again after resetRound (state is never left unrecoverable)", () => {
    setDeck([1, 13, 9, 7]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    flush();
    act(() => { result.current.resetRound(); });

    setDeck([8, 4, 7, 5]);
    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });

    expect(result.current.state.phase).toBe("playerTurns");
    expect(result.current.state.seats[0].hands[0].cards).toHaveLength(2);
  });
});

describe("placeBet / startRound guards against stray calls", () => {
  test("calling placeBet again mid-hand leaves state untouched instead of wiping it", () => {
    setDeck([8, 4, 7, 5]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    const midHandState = result.current.state;
    expect(midHandState.phase).toBe("playerTurns");

    act(() => { result.current.placeBet(0, 999); });

    expect(result.current.state.seats[0].bankroll).toBe(midHandState.seats[0].bankroll);
    expect(result.current.state.phase).toBe("playerTurns");
  });

  test("startRound is a no-op until every seat has placed a bet", () => {
    setDeck([8, 7, 6, 5, 4, 3]);
    const { result } = renderHook(() => useBlackjack(2));

    act(() => { result.current.placeBet(0, 50); result.current.startRound(); });
    expect(result.current.state.phase).toBe("betting");

    act(() => { result.current.placeBet(1, 50); result.current.startRound(); });
    expect(result.current.state.phase).toBe("playerTurns");
  });
});
