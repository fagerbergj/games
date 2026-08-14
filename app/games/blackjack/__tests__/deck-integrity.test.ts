import { shuffledDeck, drawCard, dealerDraw, calculateHandValue } from "../lib/engine";

/**
 * Property-style regression for the duplicate-card bug: deals many hands off
 * real shuffled decks and asserts no card id is ever dealt twice in one hand.
 */
describe("deck integrity — no duplicate cards in a dealt hand", () => {
  test("player + dealer hands never share a card id across many simulated deals", () => {
    for (let i = 0; i < 200; i++) {
      const deck = shuffledDeck();
      const pc1 = drawCard(deck);
      const dc1 = drawCard(pc1.remaining);
      const pc2 = drawCard(dc1.remaining);
      const dc2 = drawCard(pc2.remaining);

      let playerHand = [pc1.card, pc2.card];
      let deckAfterDeal = dc2.remaining;

      // Simple player strategy: hit until at least 17 so most deals exercise multiple draws.
      while (calculateHandValue(playerHand) < 17) {
        const next = drawCard(deckAfterDeal);
        playerHand = [...playerHand, next.card];
        deckAfterDeal = next.remaining;
      }

      const dealerResult = dealerDraw(deckAfterDeal, [dc1.card, dc2.card]);

      const allIds = [...playerHand, ...dealerResult.hand].map(c => c.id);
      expect(new Set(allIds).size).toBe(allIds.length);

      // Every card handed out came from a single fresh 52-card shoe.
      expect(dealerResult.deck.length + allIds.length).toBe(52);
    }
  });
});
