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

// Clicks chip buttons to build the wager, then taps the betting circle to commit it —
// the round auto-starts once every seat (just the one, here) has committed.
function placeBetViaChips(amount: number) {
  const denomsDesc = [500, 100, 25, 5];
  let remaining = amount;
  for (const denom of denomsDesc) {
    while (remaining >= denom) {
      fireEvent.click(screen.getByRole("button", { name: `Add $${denom} chip` }));
      remaining -= denom;
    }
  }
  fireEvent.click(screen.getByRole("button", { name: `Place bet of $${amount}` }));
}

function dealToResult(playerCards: number[], dealerUp: number, dealerHole: number, dealerDraws: number[] = [], bet = 50) {
  // draw order: player1, player2, dealerUp, dealerHole, [player hits...], [dealer draws...]
  setDeck([playerCards[0], playerCards[1], dealerUp, dealerHole, ...playerCards.slice(2), ...dealerDraws]);
  render(<GamePage />);
  placeBetViaChips(bet);
  flush();
  // No natural blackjack on either side -> still playerTurns, so stand() to reach result.
  const standButton = screen.queryByRole("button", { name: "Stand" });
  if (standButton) {
    fireEvent.click(standButton);
    flush();
  }
}

describe("result never uses a full-viewport overlay", () => {
  test("no element uses the fixed inset-0 backdrop pattern at result", () => {
    dealToResult([1, 13], 10, 7); // player natural blackjack -> fast path to result
    flush();
    expect(screen.getByText(/blackjack!/i)).toBeInTheDocument();

    const overlay = document.querySelector(".fixed.inset-0");
    expect(overlay).toBeNull();
  });

  test("the dealer's and player's final cards stay visible at result", () => {
    dealToResult([1, 13], 10, 7);
    flush();
    const playerCards = within(screen.getByTestId("player-zone")).getAllByTestId("card");
    expect(playerCards).toHaveLength(2);
    const dealerCards = within(screen.getByTestId("dealer-zone")).getAllByTestId("card");
    expect(dealerCards).toHaveLength(2);
  });
});

describe("exactly one deal-again-style control at result", () => {
  test("only New Round renders at result, not the mid-hand New Hand button", () => {
    dealToResult([1, 13], 10, 7);
    flush();

    expect(screen.queryByRole("button", { name: "New Hand" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New Round" })).toHaveLength(1);
  });

  test("header New Hand is available mid-hand, where there is no other reset control", () => {
    setDeck([8, 4, 7, 5]);
    render(<GamePage />);
    placeBetViaChips(50);
    flush();

    expect(screen.getByRole("button", { name: "New Hand" })).toBeInTheDocument();
  });

  test("New Round renders in the seat's action zone, the same spot Hit/Stand occupied", () => {
    dealToResult([1, 13], 10, 7);
    flush();

    const actionZone = screen.getByTestId("action-zone");
    expect(within(actionZone).getByRole("button", { name: "New Round" })).toBeInTheDocument();
  });
});

describe("dealer label", () => {
  test("a Dealer label renders alongside the seat's hand, without a redundant per-hand heading", () => {
    setDeck([8, 4, 7, 5]);
    render(<GamePage />);
    placeBetViaChips(50);
    flush();

    expect(within(screen.getByTestId("dealer-zone")).getByText("Dealer")).toBeInTheDocument();
    // The seat panel already shows "Seat 1" once; a single-hand seat must not repeat it inside player-zone.
    expect(screen.getByText("Seat 1")).toBeInTheDocument();
    expect(within(screen.getByTestId("player-zone")).queryByText("Seat 1")).not.toBeInTheDocument();
  });
});

describe("a sub-minimum bankroll gets a buy-back-in affordance, not a dead betting screen", () => {
  test("bankroll below the smallest chip shows 'out of chips' and a working buy-back-in button", () => {
    localStorage.setItem("blackjack_seat_bankrolls", JSON.stringify([3]));
    render(<GamePage />);

    expect(screen.getByText(/out of chips/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add $25 chip" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a chip to place a bet" })).not.toBeInTheDocument();

    // Same touch-target floor as the action row (#21) -- this is also a real-money control.
    expect(screen.getByRole("button", { name: /buy back in/i }).className).toMatch(/min-h-11/);

    fireEvent.click(screen.getByRole("button", { name: /buy back in/i }));

    expect(screen.getByTestId("bankroll-amount")).toHaveTextContent("$500");
    expect(screen.getByRole("button", { name: "Add $25 chip" })).toBeInTheDocument();
  });
});

describe("insurance decision row meets the touch-target standard PR #21 established", () => {
  // player1, player2, dealer up (ace), dealer hole -- stays in the insurance phase
  // rather than auto-resolving, since the hole card isn't a ten-value.
  function dealToInsurance(playerCards: [number, number], dealerHole: number, bet = 100) {
    setDeck([playerCards[0], playerCards[1], 1, dealerHole]);
    render(<GamePage />);
    placeBetViaChips(bet);
    flush();
  }

  test("Insurance and No insurance are 44px tall and share the action row's 16px gap", () => {
    dealToInsurance([10, 6], 9);
    expect(screen.getByText(/insurance — dealer shows an ace/i)).toBeInTheDocument();

    const insuranceBtn = screen.getByRole("button", { name: "Insurance ($50)" });
    const declineBtn = screen.getByRole("button", { name: "No insurance" });
    expect(insuranceBtn.className).toMatch(/min-h-11/);
    expect(declineBtn.className).toMatch(/min-h-11/);
    expect(insuranceBtn.parentElement!.className).toMatch(/gap-4/);
  });

  test("Even money, offered only on a player blackjack, also meets the touch-target minimum", () => {
    dealToInsurance([1, 13], 9);
    expect(screen.getByRole("button", { name: "Even money" }).className).toMatch(/min-h-11/);
  });
});

describe("dealer total is honest", () => {
  test("mid-hand, only the up-card's value shows, never the hole card's", () => {
    // dealer up=9, hole=13(K) -- if leaked, total would read 19.
    setDeck([8, 4, 9, 13]);
    render(<GamePage />);
    placeBetViaChips(50);
    flush();

    const dealerZone = screen.getByTestId("dealer-zone");
    expect(within(dealerZone).getByText((text) => text.replace(/\s+/g, " ").trim() === "9 + ?")).toBeInTheDocument();
    expect(within(dealerZone).queryByText("19")).not.toBeInTheDocument();
  });

  test("at result, the dealer's true total is shown", () => {
    setDeck([8, 4, 9, 13]); // player 12, dealer 19 -> dealer wins, no further draw
    render(<GamePage />);
    placeBetViaChips(50);
    flush();
    fireEvent.click(screen.getByRole("button", { name: "Stand" }));
    flush();

    const dealerZone = screen.getByTestId("dealer-zone");
    expect(within(dealerZone).getByText("19")).toBeInTheDocument();
  });
});

describe("card layout never hides an earlier card's corner", () => {
  test("six-card hand renders six distinct card elements with no negative overlap margin", () => {
    setDeck([2, 2, 7, 5, 2, 2, 2, 9]); // player: 2,2,2,2,2,2 = 12, safe from busting
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

describe("each hand renders exactly once, in its own zone", () => {
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

describe("dealer's turn shows a drawing indicator instead of an instant result", () => {
  test("standing shows Dealer is drawing before the result appears", () => {
    setDeck([8, 4, 7, 5, 9]); // dealer draws to resolve
    render(<GamePage />);
    placeBetViaChips(50);
    flush();
    fireEvent.click(screen.getByRole("button", { name: "Stand" }));

    expect(screen.getByText(/dealer is drawing/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Round" })).not.toBeInTheDocument();

    flush();
    expect(screen.getByRole("button", { name: "New Round" })).toBeInTheDocument();
  });
});

describe("hole card reads as a card, face down (dealer draw legibility)", () => {
  test("the hole card renders as a face-down card back during the player's turn", () => {
    setDeck([8, 4, 7, 5]);
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

describe("one persistent table across every phase", () => {
  test("the felt table and bankroll are present at betting", () => {
    render(<GamePage />);
    expect(screen.getByTestId("felt-table")).toBeInTheDocument();
    expect(screen.getByTestId("bankroll-amount")).toHaveTextContent("$500");
  });

  test("the same table is present through playerTurns, dealerTurn and result", () => {
    setDeck([8, 4, 7, 5, 9]);
    render(<GamePage />);
    placeBetViaChips(50);
    flush();
    expect(screen.getByTestId("felt-table")).toBeInTheDocument();
    expect(screen.getByTestId("dealer-zone")).toBeInTheDocument();
    expect(screen.getByTestId("player-zone")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stand" }));
    expect(screen.getByTestId("felt-table")).toBeInTheDocument();

    flush();
    expect(screen.getByTestId("felt-table")).toBeInTheDocument();
    expect(screen.getByTestId("dealer-zone")).toBeInTheDocument();
    expect(screen.getByTestId("player-zone")).toBeInTheDocument();
  });

  test("the action area swaps chips -> Hit/Stand -> New Round as the phase advances", () => {
    setDeck([8, 4, 7, 5, 9]);
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
    expect(screen.getByRole("button", { name: "New Round" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New Round" }));
    expect(screen.getByRole("button", { name: "Add $25 chip" })).toBeInTheDocument();
  });
});

describe("card count moved to a popover beside the seat's own controls", () => {
  test("the trigger opens and closes the count panel during betting, as an overlay rather than in-flow content", () => {
    render(<GamePage />);
    const trigger = screen.getByRole("button", { name: "Card count" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panelText = screen.getByText(/hidden — count it yourself/i);
    expect(panelText.closest(".absolute")).not.toBeNull();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/hidden — count it yourself/i)).not.toBeInTheDocument();
  });

  test("the trigger is also reachable during the player's turn, next to Hit/Stand", () => {
    setDeck([8, 4, 7, 5]);
    render(<GamePage />);
    placeBetViaChips(50);
    flush();

    expect(screen.getByRole("button", { name: "Hit" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Card count" }));
    expect(screen.getByText(/hidden — count it yourself/i)).toBeInTheDocument();
  });

  test("Escape closes the count popover", () => {
    render(<GamePage />);
    const trigger = screen.getByRole("button", { name: "Card count" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/hidden — count it yourself/i)).not.toBeInTheDocument();
  });

  test("with two seats, opening one seat's popover closes the other's", () => {
    render(<GamePage />);
    fireEvent.click(screen.getByRole("button", { name: "Table rules" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Seats" }), { target: { value: "2" } });
    fireEvent.keyDown(document, { key: "Escape" });

    const triggers = screen.getAllByRole("button", { name: "Card count" });
    expect(triggers).toHaveLength(2);

    fireEvent.click(triggers[0]);
    expect(screen.getAllByText(/hidden — count it yourself/i)).toHaveLength(1);

    fireEvent.click(triggers[1]);
    expect(screen.getAllByText(/hidden — count it yourself/i)).toHaveLength(1);
    expect(triggers[0]).toHaveAttribute("aria-expanded", "false");
    expect(triggers[1]).toHaveAttribute("aria-expanded", "true");
  });
});

describe("the next hand is prefilled and one tap away, no Deal button", () => {
  test("New Round prefills the previous wager as an uncommitted bet; tapping it deals immediately", () => {
    dealToResult([9, 8], 7, 6, [9], 50);
    fireEvent.click(screen.getByRole("button", { name: "New Round" }));

    const commitButton = screen.getByRole("button", { name: "Place bet of $50" });
    fireEvent.click(commitButton);
    flush();

    expect(screen.getByTestId("player-zone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /place bet/i })).not.toBeInTheDocument();
  });

  test("the very first hand of a session has nothing prefilled", () => {
    render(<GamePage />);
    expect(screen.getByRole("button", { name: "Add a chip to place a bet" })).toBeInTheDocument();
  });
});
