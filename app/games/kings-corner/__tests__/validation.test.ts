import { isValidGridPosition, isValidKingPlacement, isValidQueenPlacement, isValidJackPlacement, isGridFull, clearGrid, findPairsAddingTo10 } from "../lib/validation";
import { GameState, Card } from "../lib/types";

describe("Validation", () => {
  describe("isValidGridPosition", () => {
    it("should allow Kings in corners", () => {
      const gameState: GameState = {
        id: "1",
        players: [{ id: "p1", name: "P1", hand: [], score: 0 }],
        deck: [],
        discardPile: [],
        currentTurn: 0,
        phase: "playing",
        grid: Array(4).fill(null).map(() => Array(4).fill(null)),
      };
      const card: Card = { id: "1", suit: "hearts", rank: 13, faceUp: true };
      
      expect(isValidGridPosition(card, gameState, 0, 0)).toBe(true);
      expect(isValidGridPosition(card, gameState, 0, 3)).toBe(true);
      expect(isValidGridPosition(card, gameState, 3, 0)).toBe(true);
      expect(isValidGridPosition(card, gameState, 3, 3)).toBe(true);
    });

    it("should deny Kings in non-corners", () => {
      const gameState: GameState = {
        id: "1",
        players: [{ id: "p1", name: "P1", hand: [], score: 0 }],
        deck: [],
        discardPile: [],
        currentTurn: 0,
        phase: "playing",
        grid: Array(4).fill(null).map(() => Array(4).fill(null)),
      };
      const card: Card = { id: "1", suit: "hearts", rank: 13, faceUp: true };
      
      expect(isValidGridPosition(card, gameState, 0, 1)).toBe(false);
      expect(isValidGridPosition(card, gameState, 1, 1)).toBe(false);
    });

    it("should allow Queens on top/bottom edges", () => {
      const gameState: GameState = {
        id: "1",
        players: [{ id: "p1", name: "P1", hand: [], score: 0 }],
        deck: [],
        discardPile: [],
        currentTurn: 0,
        phase: "playing",
        grid: Array(4).fill(null).map(() => Array(4).fill(null)),
      };
      const card: Card = { id: "1", suit: "hearts", rank: 12, faceUp: true };
      
      expect(isValidGridPosition(card, gameState, 0, 1)).toBe(true);
      expect(isValidGridPosition(card, gameState, 0, 2)).toBe(true);
      expect(isValidGridPosition(card, gameState, 3, 1)).toBe(true);
      expect(isValidGridPosition(card, gameState, 3, 2)).toBe(true);
    });

    it("should deny Queens in corners", () => {
      const gameState: GameState = {
        id: "1",
        players: [{ id: "p1", name: "P1", hand: [], score: 0 }],
        deck: [],
        discardPile: [],
        currentTurn: 0,
        phase: "playing",
        grid: Array(4).fill(null).map(() => Array(4).fill(null)),
      };
      const card: Card = { id: "1", suit: "hearts", rank: 12, faceUp: true };
      
      expect(isValidGridPosition(card, gameState, 0, 0)).toBe(false);
      expect(isValidGridPosition(card, gameState, 0, 3)).toBe(false);
    });

    it("should allow Jacks on left/right edges", () => {
      const gameState: GameState = {
        id: "1",
        players: [{ id: "p1", name: "P1", hand: [], score: 0 }],
        deck: [],
        discardPile: [],
        currentTurn: 0,
        phase: "playing",
        grid: Array(4).fill(null).map(() => Array(4).fill(null)),
      };
      const card: Card = { id: "1", suit: "hearts", rank: 11, faceUp: true };
      
      expect(isValidGridPosition(card, gameState, 1, 0)).toBe(true);
      expect(isValidGridPosition(card, gameState, 2, 0)).toBe(true);
      expect(isValidGridPosition(card, gameState, 1, 3)).toBe(true);
      expect(isValidGridPosition(card, gameState, 2, 3)).toBe(true);
    });

    it("should deny Jacks in corners", () => {
      const gameState: GameState = {
        id: "1",
        players: [{ id: "p1", name: "P1", hand: [], score: 0 }],
        deck: [],
        discardPile: [],
        currentTurn: 0,
        phase: "playing",
        grid: Array(4).fill(null).map(() => Array(4).fill(null)),
      };
      const card: Card = { id: "1", suit: "hearts", rank: 11, faceUp: true };
      
      expect(isValidGridPosition(card, gameState, 0, 0)).toBe(false);
    });

    it("should allow number cards in center", () => {
      const gameState: GameState = {
        id: "1",
        players: [{ id: "p1", name: "P1", hand: [], score: 0 }],
        deck: [],
        discardPile: [],
        currentTurn: 0,
        phase: "playing",
        grid: Array(4).fill(null).map(() => Array(4).fill(null)),
      };
      const card: Card = { id: "1", suit: "hearts", rank: 5, faceUp: true };
      
      expect(isValidGridPosition(card, gameState, 1, 1)).toBe(true);
      expect(isValidGridPosition(card, gameState, 1, 2)).toBe(true);
      expect(isValidGridPosition(card, gameState, 2, 1)).toBe(true);
      expect(isValidGridPosition(card, gameState, 2, 2)).toBe(true);
    });

    it("should deny placing on occupied spot", () => {
      const gameState: GameState = {
        id: "1",
        players: [{ id: "p1", name: "P1", hand: [], score: 0 }],
        deck: [],
        discardPile: [],
        currentTurn: 0,
        phase: "playing",
        grid: [
          [{ id: "1", suit: "hearts", rank: 13, faceUp: true }, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
      };
      const card: Card = { id: "2", suit: "spades", rank: 5, faceUp: true };
      
      expect(isValidGridPosition(card, gameState, 0, 0)).toBe(false);
    });
  });

  describe("isGridFull", () => {
    it("should return true when grid is full", () => {
      const grid: (Card | null)[][] = [
        [{ id: "1", suit: "hearts", rank: 13, faceUp: true }, { id: "2", suit: "diamonds", rank: 12, faceUp: true }, { id: "3", suit: "clubs", rank: 11, faceUp: true }, { id: "4", suit: "spades", rank: 13, faceUp: true }],
        [{ id: "5", suit: "hearts", rank: 11, faceUp: true }, { id: "6", suit: "diamonds", rank: 5, faceUp: true }, { id: "7", suit: "clubs", rank: 6, faceUp: true }, { id: "8", suit: "spades", rank: 11, faceUp: true }],
        [{ id: "9", suit: "hearts", rank: 11, faceUp: true }, { id: "10", suit: "diamonds", rank: 7, faceUp: true }, { id: "11", suit: "clubs", rank: 8, faceUp: true }, { id: "12", suit: "spades", rank: 11, faceUp: true }],
        [{ id: "13", suit: "hearts", rank: 13, faceUp: true }, { id: "14", suit: "diamonds", rank: 12, faceUp: true }, { id: "15", suit: "clubs", rank: 11, faceUp: true }, { id: "16", suit: "spades", rank: 13, faceUp: true }],
      ];
      expect(isGridFull(grid)).toBe(true);
    });

    it("should return false when grid has empty spots", () => {
      const grid: (Card | null)[][] = [
        [{ id: "1", suit: "hearts", rank: 13, faceUp: true }, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ];
      expect(isGridFull(grid)).toBe(false);
    });
  });

  describe("clearGrid", () => {
    it("should clear all cards from grid", () => {
      const grid: (Card | null)[][] = [
        [{ id: "1", suit: "hearts", rank: 13, faceUp: true }, { id: "2", suit: "diamonds", rank: 12, faceUp: true }],
        [{ id: "3", suit: "clubs", rank: 11, faceUp: true }, { id: "4", suit: "spades", rank: 5, faceUp: true }],
      ];
      const cleared = clearGrid(grid);
      
      expect(cleared[0][0]).toBeNull();
      expect(cleared[0][1]).toBeNull();
      expect(cleared[1][0]).toBeNull();
      expect(cleared[1][1]).toBeNull();
    });
  });

  describe("findPairsAddingTo10", () => {
    it("should find pairs adding to 10", () => {
      const grid: (Card | null)[][] = Array(4).fill(null).map(() => Array(4).fill(null));
      grid[0][0] = { id: "1", suit: "hearts", rank: 3, faceUp: true };
      grid[0][1] = { id: "2", suit: "diamonds", rank: 5, faceUp: true };
      grid[1][0] = { id: "3", suit: "clubs", rank: 7, faceUp: true };
      grid[1][1] = { id: "4", suit: "spades", rank: 2, faceUp: true };
      const pairs = findPairsAddingTo10(grid);
      
      expect(pairs.length).toBeGreaterThan(0);
    });

    it("should find single 10s", () => {
      const grid: (Card | null)[][] = Array(4).fill(null).map(() => Array(4).fill(null));
      grid[0][0] = { id: "1", suit: "hearts", rank: 10, faceUp: true };
      grid[0][1] = { id: "2", suit: "diamonds", rank: 5, faceUp: true };
      grid[1][0] = { id: "3", suit: "clubs", rank: 7, faceUp: true };
      grid[1][1] = { id: "4", suit: "spades", rank: 2, faceUp: true };
      const pairs = findPairsAddingTo10(grid);
      
      expect(pairs.length).toBeGreaterThan(0);
    });
  });
});
