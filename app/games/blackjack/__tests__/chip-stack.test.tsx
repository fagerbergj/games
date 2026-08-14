import { render, screen } from "@testing-library/react";
import ChipStack from "../components/chip-stack";

// A multi-chip wager used to render as one legible chip: the fan offset exceeded the
// chip width, so each chip fully covered the last and $125 read as "$25".
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
