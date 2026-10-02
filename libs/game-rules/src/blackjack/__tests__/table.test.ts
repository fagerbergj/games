import {
  createTable, placeBet, startRound, takeInsurance, declineInsurance, getActiveHandActions, currentHand,
  pendingDealHandId, dealSecondCardIfNeeded, hit, stand, split, doubleDown, finishDealerAndSettle,
  resetRound, buyBackIn, calculateHandValue, DEFAULT_HOUSE_RULES, type BlackjackTableState, type Rng,
} from "..";

const DECKS = 1; // one deck so a few rounds also cross a reshuffle

// mulberry32: tiny seeded PRNG, good enough to make runs reproducible.
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playerMove(s: BlackjackTableState, rng: Rng): BlackjackTableState {
  if (pendingDealHandId(s)) return dealSecondCardIfNeeded(s, DECKS, rng);
  const acts = getActiveHandActions(s)!;
  const value = calculateHandValue(currentHand(s)!.hand.cards);
  if (acts.canSplit) return split(s, rng);
  if (acts.canDouble && value === 11) return doubleDown(s, DECKS, rng);
  return value < 17 ? hit(s, DECKS, rng) : stand(s);
}

/** One deterministic step of a scripted two-seat game; every phase makes progress. */
function step(s: BlackjackTableState, rng: Rng): BlackjackTableState {
  switch (s.phase) {
    case "betting": {
      const broke = s.seats.findIndex(seat => seat.bankroll < 25);
      if (broke !== -1) return buyBackIn(s, broke, DECKS, rng);
      const bet = s.seats.reduce((acc, _, i) => placeBet(acc, i, 25), s);
      return startRound(bet, DECKS, rng);
    }
    case "insurance":
      return declineInsurance(takeInsurance(s, 0, 5), 1);
    case "playerTurns":
      return playerMove(s, rng);
    case "dealerTurn":
      return finishDealerAndSettle(s, rng);
    case "result":
      return resetRound(s);
  }
}

function run(s: BlackjackTableState, rng: Rng, steps: number): BlackjackTableState[] {
  const states = [s];
  for (let i = 0; i < steps; i++) states.push(step(states[states.length - 1], rng));
  return states;
}

function game(seed: number, steps = 200): BlackjackTableState[] {
  const rng = seeded(seed);
  return run(createTable(2, DEFAULT_HOUSE_RULES, DECKS, rng), rng, steps);
}

describe("table determinism under an injected rng", () => {
  test("the same seed replays the same game, card ids included", () => {
    expect(game(42)).toStrictEqual(game(42));
  });

  test("a different seed deals a different game", () => {
    expect(game(42)[0].deck).not.toStrictEqual(game(43)[0].deck);
  });

  test("the scripted game covers every phase, a reshuffle and a split", () => {
    const states = game(42);
    expect(new Set(states.map(s => s.phase))).toEqual(
      new Set(["betting", "playerTurns", "dealerTurn", "result", "insurance"]),
    );
    const deckGrew = states.some((s, i) => i > 0 && s.deck.length > states[i - 1].deck.length);
    expect(deckGrew).toBe(true);
    expect(states.some(s => s.seats.some(seat => seat.hands.length > 1))).toBe(true);
  });
});

describe("table state serialisation", () => {
  test("every state survives a JSON round trip unchanged", () => {
    for (const s of game(7)) {
      expect(JSON.parse(JSON.stringify(s))).toStrictEqual(s);
    }
  });

  test("play continued from a deserialised mid-round state matches the original", () => {
    const rng = seeded(99);
    const states = run(createTable(3, DEFAULT_HOUSE_RULES, DECKS, rng), rng, 40);
    const mid = states.findLast(s => s.phase === "playerTurns")!;
    const copy = JSON.parse(JSON.stringify(mid)) as BlackjackTableState;

    expect(run(copy, seeded(5), 60)).toStrictEqual(run(mid, seeded(5), 60));
  });
});
