import { renderHook, act } from "@testing-library/react";
import { useKingsCorner } from "../hooks/useKingsCorner";
import { createDeck } from "../lib/deck";
import type { GameState } from "../lib/types";

function totalCards(state: GameState): number {
  return (
    state.deck.length +
    state.discardPile.length +
    state.grid.flat().filter(Boolean).length +
    (state.drawnCard ? 1 : 0)
  );
}

describe("cheat", () => {
  it("preserves 52 cards from a normal playing state", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });
    expect(totalCards(result.current.gameState!)).toBe(52);

    act(() => { result.current.cheat(); });
    expect(totalCards(result.current.gameState!)).toBe(52);
  });

  it("preserves 52 cards when called from gameover with cards spread across all locations", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });

    // Spread all 52 cards across grid (16), discard (8), drawn (1), deck (rest)
    const allCards = createDeck();
    const grid: GameState["grid"] = Array(4).fill(null).map(() => Array(4).fill(null));
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        grid[r][c] = allCards.shift()!;
      }
    }
    const discardPile = allCards.splice(0, 8);
    const drawnCard = allCards.shift()!;

    act(() => {
      result.current.setGameState((prev) => prev ? {
        ...prev,
        phase: "gameover",
        deck: allCards,
        discardPile,
        drawnCard,
        grid,
      } : null);
    });

    expect(totalCards(result.current.gameState!)).toBe(52);

    act(() => { result.current.cheat(); });
    expect(totalCards(result.current.gameState!)).toBe(52);
  });

  it("preserves 52 cards when the deck is empty and only a drawn card exists", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });

    const [drawnCard, ...deckCards] = createDeck();

    act(() => {
      result.current.setGameState((prev) => prev ? {
        ...prev,
        phase: "gameover",
        deck: [],
        discardPile: deckCards,
        drawnCard,
        grid: Array(4).fill(null).map(() => Array(4).fill(null)),
      } : null);
    });

    expect(totalCards(result.current.gameState!)).toBe(52);

    act(() => { result.current.cheat(); });
    expect(totalCards(result.current.gameState!)).toBe(52);
  });

  it("recovers when deck AND drawn card are both empty (the real bug)", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });

    const allCards = createDeck();
    const grid: GameState["grid"] = Array(4).fill(null).map(() => Array(4).fill(null));
    // Put 6 cards on the grid
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        grid[r][c] = allCards.shift()!;
      }
    }
    // All remaining cards in discard pile, deck and drawnCard empty
    act(() => {
      result.current.setGameState((prev) => prev ? {
        ...prev,
        phase: "gameover",
        deck: [],
        discardPile: allCards,
        drawnCard: undefined,
        grid,
      } : null);
    });

    expect(totalCards(result.current.gameState!)).toBe(52);
    expect(result.current.gameState!.phase).toBe("gameover");

    act(() => { result.current.cheat(); });

    // Discard pile cards should now be back in play
    expect(totalCards(result.current.gameState!)).toBe(52);
    expect(result.current.gameState!.discardPile.length).toBe(0);
    expect(result.current.gameState!.phase).toBe("playing");
  });
});
