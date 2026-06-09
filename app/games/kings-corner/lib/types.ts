export interface Card {
  id: string;
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  rank: number;
  faceUp: boolean;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
}

export interface GameState {
  id: string;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  currentTurn: number;
  phase: "setup" | "playing" | "cleared-grid" | "gameover" | "won";
  grid: (Card | null)[][];
  drawnCard?: Card;
  winner?: string;
  cheatCount: number;
}

export interface KingsCornerRules {
  maxPlayers: number;
  minPlayers: number;
  cardsPerPlayer: number;
}
