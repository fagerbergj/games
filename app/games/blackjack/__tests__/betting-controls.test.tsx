import { render, screen, fireEvent } from "@testing-library/react";
import BettingControls from "../components/betting-controls";

describe("item 8: chip-based betting", () => {
  test("each denomination chip has an accessible name", () => {
    render(<BettingControls bankroll={500} onBet={() => {}} />);
    for (const denom of [5, 25, 100, 500]) {
      expect(screen.getByRole("button", { name: `Add $${denom} chip` })).toBeInTheDocument();
    }
  });

  test("clicking chips accumulates the wager and announces it", () => {
    render(<BettingControls bankroll={500} onBet={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add $25 chip" }));
    fireEvent.click(screen.getByRole("button", { name: "Add $5 chip" }));
    expect(screen.getByText("Current wager $30")).toBeInTheDocument();
  });

  test("Clear resets the wager to zero", () => {
    render(<BettingControls bankroll={500} onBet={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add $100 chip" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Current wager $0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deal" })).toBeDisabled();
  });

  test("Deal is disabled at a zero wager", () => {
    render(<BettingControls bankroll={500} onBet={() => {}} />);
    expect(screen.getByRole("button", { name: "Deal" })).toBeDisabled();
  });

  test("Deal becomes enabled once a chip is added, and calls onBet with the wager", () => {
    const onBet = vi.fn();
    render(<BettingControls bankroll={500} onBet={onBet} />);
    fireEvent.click(screen.getByRole("button", { name: "Add $25 chip" }));
    const dealButton = screen.getByRole("button", { name: "Deal" });
    expect(dealButton).not.toBeDisabled();
    fireEvent.click(dealButton);
    expect(onBet).toHaveBeenCalledWith(25);
  });

  test("a chip that would exceed the bankroll is disabled and cannot be added", () => {
    render(<BettingControls bankroll={30} onBet={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add $25 chip" }));
    // 25 + 25 = 50 > 30 bankroll -- the $25 chip must now be disabled.
    expect(screen.getByRole("button", { name: "Add $25 chip" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add $100 chip" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add $25 chip" }));
    expect(screen.getByText("Current wager $25")).toBeInTheDocument(); // unchanged, click was a no-op
  });

  test("Deal is disabled when the wager would exceed the bankroll", () => {
    // Bankroll below the smallest chip -- every chip disabled, wager stuck at 0, Deal disabled.
    render(<BettingControls bankroll={2} onBet={() => {}} />);
    expect(screen.getByRole("button", { name: "Add $5 chip" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deal" })).toBeDisabled();
  });
});
