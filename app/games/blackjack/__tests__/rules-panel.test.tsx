import { render, screen, fireEvent, within } from "@testing-library/react";
import RulesPanel from "../components/rules-panel";
import { DEFAULT_HOUSE_RULES } from "../lib/houseRules";
import { DEFAULT_DECK_COUNT } from "../lib/shoe";

function setup() {
  const onRulesChange = vi.fn();
  const onSeatCountChange = vi.fn();
  const onDeckCountChange = vi.fn();
  render(
    <RulesPanel
      rules={DEFAULT_HOUSE_RULES}
      seatCount={1}
      deckCount={DEFAULT_DECK_COUNT}
      onRulesChange={onRulesChange}
      onSeatCountChange={onSeatCountChange}
      onDeckCountChange={onDeckCountChange}
    />
  );
  return { onRulesChange, onSeatCountChange, onDeckCountChange };
}

describe("table rules floats as a dialog over the felt, not an in-flow block", () => {
  test("collapsed state is a one-line summary pill; opening reveals a labelled dialog", () => {
    setup();
    expect(screen.getByText(/6 decks/)).toBeInTheDocument(); // summarizeHouseRules() text, still the closed state
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Table rules" }));
    const dialog = screen.getByRole("dialog", { name: "Table Settings" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).not.toHaveAttribute("aria-modal", "true"); // focus isn't trapped -- don't claim modality
  });

  test("Escape closes the dialog and returns focus to the trigger pill", () => {
    setup();
    const trigger = screen.getByRole("button", { name: "Table rules" });
    fireEvent.click(trigger);
    screen.getByRole("tab", { name: "Table" }).focus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test("the close button dismisses the dialog", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Table rules" }));
    fireEvent.click(screen.getByRole("button", { name: "Close table rules" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("tabs group the settings instead of one long column", () => {
  test("real tab semantics: roles, aria-selected, and panel association", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Table rules" }));

    const tablist = screen.getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map(t => t.textContent)).toEqual(["Table", "Doubling & splitting", "Surrender & insurance"]);

    const tableTab = screen.getByRole("tab", { name: "Table" });
    expect(tableTab).toHaveAttribute("aria-selected", "true");
    const panelId = tableTab.getAttribute("aria-controls");
    expect(document.getElementById(panelId!)).toHaveAttribute("aria-labelledby", tableTab.id);
  });

  test("arrow keys move between tabs and switch the visible panel", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Table rules" }));

    const tableTab = screen.getByRole("tab", { name: "Table" });
    tableTab.focus();
    fireEvent.keyDown(tableTab, { key: "ArrowRight" });

    const doublingTab = screen.getByRole("tab", { name: "Doubling & splitting" });
    expect(doublingTab).toHaveAttribute("aria-selected", "true");
    expect(doublingTab).toHaveFocus();
    expect(screen.getByText(/allows doubling down on a hand you already split/i)).toBeVisible();
  });

  test("switching tabs does not change the dialog's height", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Table rules" }));
    const dialog = screen.getByRole("dialog");
    const before = dialog.className;

    fireEvent.click(screen.getByRole("tab", { name: "Surrender & insurance" }));
    expect(dialog.className).toBe(before); // no height-affecting class swap between tabs
  });

  test("every setting is reachable through some tab", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Table rules" }));

    // Table tab (default): deck count, seats, payout, soft 17, peek.
    expect(screen.getByRole("combobox", { name: "Seats" })).toBeInTheDocument();
    expect(screen.getByText(/blackjack payout/i)).toBeInTheDocument();
    expect(screen.getByText(/dealer soft 17/i)).toBeInTheDocument();
    expect(screen.getByText(/dealer peek/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Doubling & splitting" }));
    expect(screen.getByText(/double down on/i)).toBeInTheDocument();
    expect(screen.getByText(/double after split/i)).toBeInTheDocument();
    expect(screen.getByText(/splits allowed/i)).toBeInTheDocument();
    expect(screen.getByText(/split aces get one card/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Surrender & insurance" }));
    expect(screen.getByText(/^surrender$/i)).toBeInTheDocument();
    expect(screen.getByText(/^insurance$/i)).toBeInTheDocument();
  });
});
