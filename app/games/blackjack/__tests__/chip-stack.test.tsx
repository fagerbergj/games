import { render, screen } from "@testing-library/react";
import ChipStack from "../components/chip-stack";

// Stacked chips can overlap on multi-chip wagers, so `showTotal` displays the
// numeric wager explicitly while remaining opt-in for callers with their own label.
describe("wager legibility", () => {
  test("showTotal states the wager as a number", () => {
    render(<ChipStack amount={125} showTotal />);
    expect(screen.getByText("$125")).toBeInTheDocument();
  });

  test("a fractional wager keeps two decimals", () => {
    render(<ChipStack amount={12.5} showTotal />);
    expect(screen.getByText("$12.50")).toBeInTheDocument();
  });

  test("the total is opt-in, so sites with their own label do not double up", () => {
    render(<ChipStack amount={125} />);
    expect(screen.queryByText("$125")).not.toBeInTheDocument();
  });

  test("an empty wager still renders the placeholder circle", () => {
    render(<ChipStack amount={0} showTotal />);
    expect(screen.getByText("Bet")).toBeInTheDocument();
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
  });
});
