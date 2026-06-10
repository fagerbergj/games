import { renderHook, act } from "@testing-library/react";
import { useKingsCorner } from "../hooks/useKingsCorner";
import { createDeck } from "../lib/deck";

describe("win condition", () => {
  it("fires 'won' via resumePlaying when deck is empty and grid is clear", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });

    // Grid is empty, deck is empty — clicking Done Discarding should win
    act(() => {
      result.current.setGameState((prev) => prev ? {
        ...prev,
        phase: "cleared-grid",
        deck: [],
        discardPile: createDeck(),
        drawnCard: undefined,
        grid: Array(4).fill(null).map(() => Array(4).fill(null)),
      } : null);
    });

    act(() => { result.current.resumePlaying(); });

    expect(result.current.gameState!.phase).toBe("won");
  });

  it("transitions to cleared-grid (not gameover) when deck empties mid-placement", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });

    const card7 = { id: "c7", suit: "hearts" as const, rank: 7, faceUp: true };
    const card3 = { id: "c3", suit: "clubs" as const, rank: 3, faceUp: true };
    const grid = Array(4).fill(null).map(() => Array(4).fill(null));
    grid[1][2] = card3; // center spot occupied

    act(() => {
      result.current.setGameState((prev) => prev ? {
        ...prev,
        phase: "playing",
        deck: [],
        discardPile: [],
        drawnCard: card7,
        grid,
      } : null);
    });

    // Place 7 in center [1][1] — deck is empty so should go to cleared-grid, not gameover
    act(() => { result.current.playCard(1, 1); });

    expect(result.current.gameState!.phase).toBe("cleared-grid");
    expect(result.current.gameState!.deck.length).toBe(0);
  });

  it("fires 'gameover' via resumePlaying when deck is empty but grid still has cards", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });

    const allCards = createDeck();
    const grid = Array(4).fill(null).map(() => Array(4).fill(null));
    grid[0][0] = allCards[0]; // one card still on the grid

    act(() => {
      result.current.setGameState((prev) => prev ? {
        ...prev,
        phase: "cleared-grid",
        deck: [],
        discardPile: allCards.slice(1),
        drawnCard: undefined,
        grid,
      } : null);
    });

    act(() => { result.current.resumePlaying(); });

    expect(result.current.gameState!.phase).toBe("gameover");
  });
});
