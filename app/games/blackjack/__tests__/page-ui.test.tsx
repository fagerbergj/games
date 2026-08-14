import { render, screen, within, act, fireEvent } from "@testing-library/react";
import GamePage from "../page";

// Same deterministic-deck trick as game-flow.test.ts. Reshuffling disabled --
// out of scope for these UI tests, covered separately in shoe-continuity.test.ts.
let mockRanks: number[] = [];
vi.mock("../lib/shoe", async () => {
  const actual = await vi.importActual<typeof import("../lib/shoe")>("../lib/shoe");
  return {
    ...actual,
    createShoe: () => mockRanks.map((rank, i) => ({ id: `m-${i}`, suit: "spades" as const, rank, faceUp: true })),
    needsReshuffle: () => false,
  };
});
function setDeck(ranks: number[]) {
  mockRanks = [...ranks, ...Array(20).fill(2)];
}
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

// Clicks a chip button by its accessible name, then Deal — drives the game
// through the same chip-based betting flow a player uses. Each fireEvent
// call is its own act() cycle, so state re-renders between clicks the way
// real, separately-dispatched user clicks would (batching all of them under
// one outer act() would let the Deal handler close over a stale $0 wager).
function placeBetViaChips(amount: number) {
  const denomsDesc = [500, 100, 25, 5];
  let remaining = amount;
  for (const denom of denomsDesc) {
    while (remaining >= denom) {
      fireEvent.click(screen.getByRole("button", { name: `Add $${denom} chip` }));
      remaining -= denom;
    }
  }
  fireEvent.click(screen.getByRole("button", { name: "Deal" }));
}

function dealToResult(playerCards: number[], dealerUp: number, dealerHole: number, dealerDraws: number[] = [], bet = 50) {
  // draw order: player1, dealerUp, player2, dealerHole, [player hits...], [dealer draws...]
  setDeck([playerCards[0], dealerUp, playerCards[1], dealerHole, ...playerCards.slice(2), ...dealerDraws]);
  render(<GamePage />);
  placeBetViaChips(bet);
  flush();
  // No natural blackjack on either side -> still playerTurn, so stand() to reach result.
  const standButton = screen.queryByRole("button", { name: "Stand" });
  if (standButton) {
    fireEvent.click(standButton);
    flush();
  }
}

describe("item 1: result never uses a full-viewport overlay", () => {
  test("no element uses the fixed inset-0 backdrop pattern at result", () => {
    dealToResult([1, 13], 10, 7); // player natural blackjack -> fast path to result
    flush();
    expect(screen.getByText(/blackjack!/i)).toBeInTheDocument(); // the result banner, not the "Blackjack" page title

    const overlay = document.querySelector(".fixed.inset-0");
    expect(overlay).toBeNull();
  });

  test("the dealer's and player's final cards stay visible at result", () => {
    dealToResult([1, 13], 10, 7);
    flush();
    // Ace/King for the player should still be on screen, not hidden behind a modal.
    const playerCards = within(screen.getByTestId("player-zone")).getAllByTestId("card");
    expect(playerCards).toHaveLength(2);
    const dealerCards = within(screen.getByTestId("dealer-zone")).getAllByTestId("card");
    expect(dealerCards).toHaveLength(2);
  });
});

describe("item 2: exactly one deal-again-style control at result", () => {
  test("only Deal Again renders at result, not a second New Hand button", () => {
    dealToResult([1, 13], 10, 7);
    flush();

    expect(screen.queryByRole("button", { name: "New Hand" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Deal Again" })).toHaveLength(1);
  });

  test("header New Hand is available mid-hand, where there is no other reset control", () => {
    setDeck([8, 7, 4, 5]);
    render(<GamePage />);
    placeBetViaChips(50);
    flush();

    expect(screen.getByRole("button", { name: "New Hand" })).toBeInTheDocument();
  });
});

describe("item 3: dealer label", () => {
  test("a Dealer label renders alongside Your Hand", () => {
    setDeck([8, 7, 4, 5]);
    render(<GamePage />);
    placeBetViaChips(50);
    flush();

    expect(within(screen.getByTestId("dealer-zone")).getByText("Dealer")).toBeInTheDocument();
    expect(within(screen.getByTestId("player-zone")).getByText("Your Hand")).toBeInTheDocument();
  });
});

describe("item 4: dealer total is honest", () => {
  test("mid-hand, only the up-card's value shows, never the hole card's", () => {
    // dealer up=9, hole=13(K) -- if leaked, total would read 19.
    setDeck([8, 9, 4, 13]);
    render(<GamePage />);
    placeBetViaChips(50);
    flush();

    const dealerZone = screen.getByTestId("dealer-zone");
    expect(within(dealerZone).getByText((text) => text.replace(/\s+/g, " ").trim() === "9 + ?")).toBeInTheDocument();
    expect(within(dealerZone).queryByText("19")).not.toBeInTheDocument();
  });

  test("at result, the dealer's true total is shown", () => {
    setDeck([8, 9, 4, 13]); // player 12, dealer 19 -> dealer wins, no further draw
    render(<GamePage />);
    placeBetViaChips(50);
    flush();
    fireEvent.click(screen.getByRole("button", { name: "Stand" }));
    flush();

    const dealerZone = screen.getByTestId("dealer-zone");
    expect(within(dealerZone).getByText("19")).toBeInTheDocument();
  });
});

describe("item 5: card layout never hides an earlier card's corner", () => {
  test("six-card hand renders six distinct card elements with no negative overlap margin", () => {
    // player draws up to 6 cards via repeated hit()s.
    setDeck([2, 7, 2, 5, 2, 2, 2, 9]); // player: 2,2,2,2,2,2 = 12, safe from busting
    render(<GamePage />);
    placeBetViaChips(50);
    flush();

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Hit" }));
      flush();
    }

    const playerZone = screen.getByTestId("player-zone");
    const cards = within(playerZone).getAllByTestId("card");
    expect(cards.length).toBe(6);
    cards.forEach(card => {
      const row = card.parentElement!;
      expect(row.className).not.toMatch(/-space-x/);
    });
  });
});

describe("item 6: each hand renders exactly once, in its own zone", () => {
  test("the dealer's cards appear only inside the dealer zone at result, not after the player's hand", () => {
    dealToResult([9, 8], 7, 6, [9]); // dealer draws one extra card to resolve
    flush();

    const dealerZone = screen.getByTestId("dealer-zone");
    const playerZone = screen.getByTestId("player-zone");

    const dealerCards = within(dealerZone).getAllByTestId("card");
    const playerCards = within(playerZone).getAllByTestId("card");

    // 2 player cards + 3 dealer cards (up, hole, one drawn) = 5 total on the page, no duplicates.
    expect(screen.getAllByTestId("card")).toHaveLength(5);
    expect(playerCards).toHaveLength(2);
    expect(dealerCards).toHaveLength(3);
  });
});

describe("item 7 (UI): dealer's turn shows a drawing indicator instead of an instant result", () => {
  test("standing shows Dealer is drawing before the result appears", () => {
    setDeck([8, 7, 4, 5, 9]); // dealer draws to resolve
    render(<GamePage />);
    placeBetViaChips(50);
    flush();
    fireEvent.click(screen.getByRole("button", { name: "Stand" }));

    expect(screen.getByText(/dealer is drawing/i)).toBeInTheDocument();
    expect(screen.queryByText("Deal Again")).not.toBeInTheDocument();

    flush();
    expect(screen.getByRole("button", { name: "Deal Again" })).toBeInTheDocument();
  });
});

describe("hole card reads as a card, face down (dealer draw legibility)", () => {
  test("the hole card renders as a face-down card back during the player's turn", () => {
    setDeck([8, 7, 4, 5]);
    render(<GamePage />);
    placeBetViaChips(50);
    flush();

    const dealerZone = screen.getByTestId("dealer-zone");
    expect(within(dealerZone).getAllByTestId("card-back")).toHaveLength(1);
    expect(within(dealerZone).getAllByTestId("card")).toHaveLength(1); // the up-card
  });

  test("the hole card flips to a face-up card once revealed", () => {
    dealToResult([9, 8], 7, 6, [9]);
    flush();

    const dealerZone = screen.getByTestId("dealer-zone");
    expect(within(dealerZone).queryAllByTestId("card-back")).toHaveLength(0);
  });
});

describe("item 10: one persistent table across every phase", () => {
  test("the felt table, dealer zone, player zone and bankroll are present at betting", () => {
    render(<GamePage />);
    expect(screen.getByTestId("felt-table")).toBeInTheDocument();
    expect(screen.getByTestId("dealer-zone")).toBeInTheDocument();
    expect(screen.getByTestId("player-zone")).toBeInTheDocument();
    expect(screen.getByTestId("bankroll-amount")).toHaveTextContent("$500");
  });

  test("the same table is present through playerTurn, dealerTurn and result", () => {
    setDeck([8, 7, 4, 5, 9]);
    render(<GamePage />);
    placeBetViaChips(50);
    flush();
    expect(screen.getByTestId("felt-table")).toBeInTheDocument();
    expect(screen.getByTestId("dealer-zone")).toBeInTheDocument();
    expect(screen.getByTestId("player-zone")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stand" }));
    expect(screen.getByTestId("felt-table")).toBeInTheDocument();
    expect(screen.getByTestId("dealer-zone")).toBeInTheDocument();
    expect(screen.getByTestId("player-zone")).toBeInTheDocument();

    flush();
    expect(screen.getByTestId("felt-table")).toBeInTheDocument();
    expect(screen.getByTestId("dealer-zone")).toBeInTheDocument();
    expect(screen.getByTestId("player-zone")).toBeInTheDocument();
  });

  test("the action area swaps chips -> Hit/Stand -> Deal Again as the phase advances", () => {
    setDeck([8, 7, 4, 5, 9]);
    render(<GamePage />);

    expect(screen.getByRole("button", { name: "Add $25 chip" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hit" })).not.toBeInTheDocument();

    placeBetViaChips(50);
    flush();
    expect(screen.queryByRole("button", { name: "Add $25 chip" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stand" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stand" }));
    expect(screen.queryByRole("button", { name: "Hit" })).not.toBeInTheDocument();

    flush();
    expect(screen.getByRole("button", { name: "Deal Again" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Deal Again" }));
    expect(screen.getByRole("button", { name: "Add $25 chip" })).toBeInTheDocument();
  });
});
