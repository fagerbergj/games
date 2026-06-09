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
