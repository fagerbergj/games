import { createDeck, shuffle, dealCards, drawCard, getCardValue, getCardSymbol, getSuitSymbol } from "../lib/deck";
import { Card } from "../lib/types";

describe("Deck Operations", () => {
  describe("createDeck", () => {
    it("should create a 52-card deck", () => {
      const deck = createDeck();
      expect(deck.length).toBe(52);
    });

    it("should have 13 cards of each suit", () => {
      const deck = createDeck();
      const suits: Record<string, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 };

      for (const card of deck) {
        suits[card.suit]++;
      }

      expect(suits.hearts).toBe(13);
      expect(suits.diamonds).toBe(13);
      expect(suits.clubs).toBe(13);
      expect(suits.spades).toBe(13);
    });
  });

  describe("shuffle", () => {
    it("should shuffle an array", () => {
      const array = [1, 2, 3, 4, 5];
      const shuffled = shuffle(array);

      expect(shuffled.length).toBe(5);
      expect(shuffled).not.toEqual(array);
    });
  });

  describe("dealCards", () => {
    it("should deal cards to players", () => {
      const deck = createDeck();
      const players = 2;
      const cardsPerPlayer = 7;
      const dealt = dealCards(deck, players, cardsPerPlayer);

      expect(dealt.length).toBe(players);
      expect(dealt[0].length).toBe(cardsPerPlayer);
      expect(dealt[1].length).toBe(cardsPerPlayer);
      expect(deck.length).toBe(52 - players * cardsPerPlayer);
    });
  });

  describe("drawCard", () => {
    it("should draw a card from the deck", () => {
      const deck = createDeck();
      const initialLength = deck.length;
      const card = drawCard(deck);

      expect(card).toBeDefined();
      expect(deck.length).toBe(initialLength - 1);
    });

    it("should return undefined when deck is empty", () => {
      const deck: Card[] = [];
      const card = drawCard(deck);

      expect(card).toBeUndefined();
    });
  });

  describe("getCardValue", () => {
    it("should return correct value for number cards", () => {
      expect(getCardValue(1)).toBe(1);
      expect(getCardValue(5)).toBe(5);
      expect(getCardValue(10)).toBe(10);
    });

    it("should return 10 for face cards", () => {
      expect(getCardValue(11)).toBe(10);
      expect(getCardValue(12)).toBe(10);
      expect(getCardValue(13)).toBe(10);
    });
  });

  describe("getCardSymbol", () => {
    it("should return correct symbols", () => {
      expect(getCardSymbol(1)).toBe("A");
      expect(getCardSymbol(11)).toBe("J");
      expect(getCardSymbol(12)).toBe("Q");
      expect(getCardSymbol(13)).toBe("K");
      expect(getCardSymbol(5)).toBe("5");
    });
  });

  describe("getSuitSymbol", () => {
    it("should return correct suit symbols", () => {
      expect(getSuitSymbol("hearts")).toBe("♥");
      expect(getSuitSymbol("diamonds")).toBe("♦");
      expect(getSuitSymbol("clubs")).toBe("♣");
      expect(getSuitSymbol("spades")).toBe("♠");
    });
  });
});
