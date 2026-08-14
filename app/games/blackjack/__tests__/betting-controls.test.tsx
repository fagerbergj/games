import { render, screen, fireEvent } from "@testing-library/react";
import BettingControls from "../components/betting-controls";

describe("item 8: chip-based betting", () => {
  test("each denomination chip has an accessible name", () => {
    render(<BettingControls bankroll={500} pendingBet={0} lastWager={0} onBet={() => {}} />);
    for (const denom of [5, 25, 100, 500]) {
      expect(screen.getByRole("button", { name: `Add $${denom} chip` })).toBeInTheDocument();
    }
  });

  test("clicking chips accumulates the wager and announces it", () => {
    render(<BettingControls bankroll={500} pendingBet={0} lastWager={0} onBet={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add $25 chip" }));
    fireEvent.click(screen.getByRole("button", { name: "Add $5 chip" }));
    expect(screen.getByText("Current wager $30")).toBeInTheDocument();
  });

  test("Clear resets the wager to zero and disables the commit circle", () => {
    render(<BettingControls bankroll={500} pendingBet={0} lastWager={0} onBet={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add $100 chip" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Current wager $0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a chip to place a bet" })).toBeDisabled();
  });

  test("the betting circle is disabled at a zero wager", () => {
    render(<BettingControls bankroll={500} pendingBet={0} lastWager={0} onBet={() => {}} />);
    expect(screen.getByRole("button", { name: "Add a chip to place a bet" })).toBeDisabled();
  });

  test("tapping the circle becomes enabled once a chip is added, and commits the wager via onBet", () => {
    const onBet = vi.fn();
    render(<BettingControls bankroll={500} pendingBet={0} lastWager={0} onBet={onBet} />);
    fireEvent.click(screen.getByRole("button", { name: "Add $25 chip" }));
    const commitButton = screen.getByRole("button", { name: "Place bet of $25" });
    expect(commitButton).not.toBeDisabled();
    fireEvent.click(commitButton);
    expect(onBet).toHaveBeenCalledWith(25);
  });

  test("a chip that would exceed the bankroll is disabled and cannot be added", () => {
    render(<BettingControls bankroll={30} pendingBet={0} lastWager={0} onBet={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add $25 chip" }));
    // 25 + 25 = 50 > 30 bankroll -- the $25 chip must now be disabled.
    expect(screen.getByRole("button", { name: "Add $25 chip" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add $100 chip" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add $25 chip" }));
    expect(screen.getByText("Current wager $25")).toBeInTheDocument(); // unchanged, click was a no-op
  });

  test("a bankroll below the smallest chip leaves every chip disabled and the circle uncommittable", () => {
    render(<BettingControls bankroll={2} pendingBet={0} lastWager={0} onBet={() => {}} />);
    expect(screen.getByRole("button", { name: "Add $5 chip" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add a chip to place a bet" })).toBeDisabled();
  });

  test("a previous wager that fits the bankroll is prefilled, uncommitted, and one tap commits it", () => {
    const onBet = vi.fn();
    render(<BettingControls bankroll={500} pendingBet={0} lastWager={25} onBet={onBet} />);
    const commitButton = screen.getByRole("button", { name: "Place bet of $25" });
    expect(commitButton).not.toBeDisabled();
    fireEvent.click(commitButton);
    expect(onBet).toHaveBeenCalledWith(25);
  });

  test("a previous wager that exceeds the bankroll is not prefilled", () => {
    render(<BettingControls bankroll={20} pendingBet={0} lastWager={25} onBet={() => {}} />);
    expect(screen.getByText("Current wager $0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a chip to place a bet" })).toBeDisabled();
  });

  test("once committed, the seat shows a placed bet and waits instead of offering chips again", () => {
    render(<BettingControls bankroll={500} pendingBet={50} lastWager={0} onBet={() => {}} />);
    expect(screen.getByText(/bet placed/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add $25 chip" })).not.toBeInTheDocument();
  });
});
