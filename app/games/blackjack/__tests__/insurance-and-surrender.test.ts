import { renderHook, act } from "@testing-library/react";
import { useBlackjack } from "../hooks/useBlackjack";
import { getHouseRules } from "../lib/houseRules";

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
  mockRanks = [...ranks, ...Array(30).fill(2)];
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

describe("insurance", () => {
  test("dealer shows an ace and insurance is enabled -> table enters the insurance phase", () => {
    // player [10,6]=16, dealer up=1(A) hole=9=... not a natural.
    setDeck([10, 6, 1, 9]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    expect(result.current.state.phase).toBe("insurance");
  });

  test("taking full insurance wins 2:1 when the dealer has a natural", () => {
    // player [10,6]=16, dealer [A,K]=21 BJ.
    setDeck([10, 6, 1, 13]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    act(() => { result.current.takeInsurance(0, 50); }); // max insurance = bet/2 = 50
    flush();

    const seat = result.current.state.seats[0];
    expect(seat.insurance).toEqual({ bet: 50, result: "win" });
    // Main hand loses (-100), insurance wins net +100 (2:1 on 50) -> net 0 overall.
    expect(seat.hands[0].result?.result).toBe("loss");
    expect(seat.bankroll).toBe(startBankroll - 100 + 100);
  });

  test("declining insurance loses nothing extra when the dealer has a natural", () => {
    setDeck([10, 6, 1, 13]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    act(() => { result.current.declineInsurance(0); });
    flush();

    expect(result.current.state.seats[0].bankroll).toBe(startBankroll - 100);
  });

  test("insurance loses the side bet when the dealer does not have a natural", () => {
    // player [10,6]=16, dealer up=1(A) hole=9 -> [A,9]=20, no natural.
    setDeck([10, 6, 1, 9]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    act(() => { result.current.takeInsurance(0, 50); });
    expect(result.current.state.phase).toBe("playerTurns");
    act(() => { result.current.stand(); });
    flush();

    const seat = result.current.state.seats[0];
    expect(seat.insurance?.result).toBe("loss");
    // 16 vs dealer 20 -> main hand loses 100, insurance loses 50 more.
    expect(seat.bankroll).toBe(startBankroll - 100 - 50);
  });

  test("insurance is capped at half the original bet even if a larger amount is requested", () => {
    setDeck([10, 6, 1, 9]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    act(() => { result.current.takeInsurance(0, 999); });

    expect(result.current.state.seats[0].insurance?.bet).toBe(50);
  });

  test("even money on a player blackjack locks in a guaranteed 1:1 payout immediately", () => {
    // player [A,K]=21 BJ, dealer up=1(A) hole=9 -> no dealer BJ, so a normal blackjack would pay 150.
    setDeck([1, 13, 1, 9]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    expect(result.current.state.phase).toBe("insurance");
    act(() => { result.current.takeEvenMoney(0); });
    flush();

    const seat = result.current.state.seats[0];
    expect(seat.hands[0].result).toEqual({ result: "even-money", amount: 100 });
    expect(seat.bankroll).toBe(startBankroll + 100); // not the 150 a real blackjack would have paid
  });

  test("insurance disabled by house rule: no ace-up dealer ever pauses the round for it", () => {
    setDeck([10, 6, 1, 9]);
    const { result } = renderHook(() => useBlackjack(1));
    act(() => { result.current.setHouseRules({ ...getHouseRules(), insuranceEnabled: false }); });

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    expect(result.current.state.phase).toBe("playerTurns");
  });
});

describe("surrender", () => {
  test("surrendering returns exactly half the bet and ends the hand immediately", () => {
    // player [10,6]=16, dealer up=7 hole=9=16 (not insurable).
    setDeck([10, 6, 7, 9]);
    const { result } = renderHook(() => useBlackjack(1));
    const startBankroll = result.current.state.seats[0].bankroll;

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    expect(result.current.actions?.canSurrender).toBe(true);

    act(() => { result.current.surrender(); });
    flush();

    const seat = result.current.state.seats[0];
    expect(seat.hands[0].status).toBe("surrendered");
    expect(seat.hands[0].result).toEqual({ result: "surrender", amount: -50 });
    expect(seat.bankroll).toBe(startBankroll - 50);
  });

  test("surrender is unavailable once disabled by house rule", () => {
    setDeck([10, 6, 7, 9]);
    const { result } = renderHook(() => useBlackjack(1));
    act(() => { result.current.setHouseRules({ ...getHouseRules(), surrender: "none" }); });

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    expect(result.current.actions?.canSurrender).toBe(false);
  });

  test("surrender is unavailable after a hit", () => {
    setDeck([10, 6, 7, 9, 2]);
    const { result } = renderHook(() => useBlackjack(1));

    act(() => { result.current.placeBet(0, 100); result.current.startRound(); });
    act(() => { result.current.hit(); });
    expect(result.current.actions?.canSurrender).toBe(false);
  });
});
