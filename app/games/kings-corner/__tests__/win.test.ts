import { renderHook, act } from "@testing-library/react";
import { useKingsCorner } from "../hooks/useKingsCorner";
import { areEdgesComplete } from "../lib/validation";
import { createDeck } from "../lib/deck";
import { Card } from "../lib/types";

const card = (rank: number, id: string): Card => ({ id, suit: "spades", rank, faceUp: true });

// Edge positions and the face card each requires:
// corners -> Kings (13), top/bottom -> Queens (12), left/right -> Jacks (11)
const EDGES: [number, number, number][] = [
  [0, 0, 13], [0, 3, 13], [3, 0, 13], [3, 3, 13],
  [0, 1, 12], [0, 2, 12], [3, 1, 12], [3, 2, 12],
  [1, 0, 11], [2, 0, 11], [1, 3, 11], [2, 3, 11],
];

// A grid with every edge correctly filled except the one space at (omitRow, omitCol).
function edgesFilledExcept(omitRow: number, omitCol: number): (Card | null)[][] {
  const grid: (Card | null)[][] = Array(4).fill(null).map(() => Array(4).fill(null));
  for (const [r, c, rank] of EDGES) {
    if (r === omitRow && c === omitCol) continue;
    grid[r][c] = card(rank, `e-${r}-${c}`);
  }
  return grid;
}

describe("areEdgesComplete", () => {
  it("is true when all 12 edges hold their required face card", () => {
    const grid = edgesFilledExcept(-1, -1); // omit nothing
    expect(areEdgesComplete(grid)).toBe(true);
  });

  it("ignores the center number spaces", () => {
    const grid = edgesFilledExcept(-1, -1);
    grid[1][1] = card(5, "center"); // center occupied or not — irrelevant
    expect(areEdgesComplete(grid)).toBe(true);
    grid[1][1] = null;
    expect(areEdgesComplete(grid)).toBe(true);
  });

  it("is false while any edge is empty", () => {
    expect(areEdgesComplete(edgesFilledExcept(0, 0))).toBe(false);
  });

  it("is false when an edge holds the wrong rank", () => {
    const grid = edgesFilledExcept(-1, -1);
    grid[0][0] = card(12, "wrong-corner"); // Queen in a corner
    expect(areEdgesComplete(grid)).toBe(false);
  });
});

describe("win condition", () => {
  it("fires 'won' immediately when the final edge card is placed", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });

    // Only the top-left corner is empty; draw the King that completes it.
    act(() => {
      result.current.setGameState((prev) => prev ? {
        ...prev,
        phase: "playing",
        deck: createDeck(), // deck still full — win must not wait for it to empty
        discardPile: [],
        drawnCard: card(13, "winning-king"),
        grid: edgesFilledExcept(0, 0),
      } : null);
    });

    act(() => { result.current.playCard(0, 0); });

    expect(result.current.gameState!.phase).toBe("won");
    expect(result.current.gameState!.drawnCard).toBeUndefined();
  });

  it("does not win when a placement leaves an edge still empty", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });

    // Two corners empty; placing one King leaves the other open.
    const grid = edgesFilledExcept(0, 0);
    grid[3][3] = null;

    act(() => {
      result.current.setGameState((prev) => prev ? {
        ...prev,
        phase: "playing",
        deck: createDeck(),
        discardPile: [],
        drawnCard: card(13, "king"),
        grid,
      } : null);
    });

    act(() => { result.current.playCard(0, 0); });

    expect(result.current.gameState!.phase).toBe("playing");
  });

  it("transitions to cleared-grid (not gameover) when deck empties mid-placement", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });

    const card7 = card(7, "c7");
    const card3 = card(3, "c3");
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

  it("fires 'gameover' via resumePlaying when the deck is empty", () => {
    const { result } = renderHook(() => useKingsCorner());
    act(() => { result.current.initializeGame(); });

    const allCards = createDeck();
    const grid = Array(4).fill(null).map(() => Array(4).fill(null));
    grid[0][0] = allCards[0]; // a card still on the grid

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
