import { Card } from "./types";

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let idCounter = 0;

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `card-${idCounter++}`,
        suit,
        rank,
        faceUp: true,
      });
    }
  }

  return shuffle(deck);
}

export function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function dealCards(deck: Card[], players: number, cardsPerPlayer: number): Card[][] {
  const dealt: Card[][] = [];
  for (let i = 0; i < players; i++) {
    dealt.push([]);
  }

  for (let i = 0; i < players * cardsPerPlayer; i++) {
    const playerIndex = i % players;
    const card = deck.shift();
    if (card) {
      dealt[playerIndex].push(card);
    }
  }

  return dealt;
}

export function drawCard(deck: Card[]): Card | undefined {
  return deck.shift();
}

export function getCardValue(rank: number): number {
  if (rank === 11) return 10;
  if (rank === 12) return 10;
  if (rank === 13) return 10;
  return rank;
}

export function getCardSymbol(rank: number): string {
  const symbols: Record<number, string> = {
    1: "A",
    11: "J",
    12: "Q",
    13: "K",
  };
  return symbols[rank] || rank.toString();
}

export function getSuitSymbol(suit: string): string {
  const symbols: Record<string, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };
  return symbols[suit] || suit;
}
