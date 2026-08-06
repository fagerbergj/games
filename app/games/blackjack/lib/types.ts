export type GamePhase = "betting" | "dealing" | "playerTurn" | "dealerTurn" | "result";

export interface BlackjackResult {
  result: "win" | "loss" | "push" | "blackjack";
  amount: number;
}

export interface BlackjackState {
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  phase: GamePhase;
  bet: number;
  bankroll: number;
  result?: BlackjackResult;
}

export interface Card {
  id: string;
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  rank: number;
  faceUp: boolean;
}
