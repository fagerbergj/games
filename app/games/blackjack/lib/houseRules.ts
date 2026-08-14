import type { HouseRules } from "./types";

const KEY = "blackjack_house_rules";

// Defaults model a common Vegas 6-deck S17 shoe game (Wynn 6-deck S17/DAS/RSA/LS is a real
// example) — see PR description for sources on H17 prevalence, RSA-to-4-hands, and 6:5 payouts.
export const DEFAULT_HOUSE_RULES: HouseRules = {
  dealerHitsSoft17: false,
  blackjackPayout: "3:2",
  doubleAfterSplit: true,
  doubleRestriction: "any2",
  surrender: "late",
  insuranceEnabled: true,
  maxSplits: 3,
  splitAcesOneCardOnly: true,
  dealerPeek: "peek",
};

export const MAX_SPLITS_CAP = 3;

export const HOUSE_RULE_LABELS: Record<keyof HouseRules, { title: string; blurb: string }> = {
  dealerHitsSoft17: {
    title: "Dealer soft 17",
    blurb: "H17: dealer hits soft 17 (better for the house). S17: dealer stands (better for you).",
  },
  blackjackPayout: {
    title: "Blackjack payout",
    blurb: "3:2 is the standard payout. 6:5 pays less on every natural — avoid it if you can.",
  },
  doubleAfterSplit: {
    title: "Double after split (DAS)",
    blurb: "Allows doubling down on a hand you already split.",
  },
  doubleRestriction: {
    title: "Double down on",
    blurb: "Any two cards, or restricted to hard totals of 9, 10, or 11.",
  },
  surrender: {
    title: "Surrender",
    blurb: "Late surrender forfeits half your bet to bail out of a bad hand before it's played.",
  },
  insuranceEnabled: {
    title: "Insurance",
    blurb: "Offered when the dealer shows an ace; pays 2:1 if the dealer has blackjack.",
  },
  maxSplits: {
    title: "Splits allowed",
    blurb: "How many times a pair can be split, 0-3 (3 splits = 4 hands). 0 disables splitting.",
  },
  splitAcesOneCardOnly: {
    title: "Split aces get one card",
    blurb: "Each hand from a split pair of aces gets exactly one more card, then stands.",
  },
  dealerPeek: {
    title: "Dealer peek",
    blurb: "Peek: dealer checks for blackjack before you act. No peek / ENHC: your extra bets are at risk.",
  },
};

/** One-line summary for the collapsed rules panel, e.g. "6 decks · S17 · 3:2 · DAS · Late surrender · 3 splits". */
export function summarizeHouseRules(rules: HouseRules, deckCount: number): string {
  return [
    `${deckCount} deck${deckCount > 1 ? "s" : ""}`,
    rules.dealerHitsSoft17 ? "H17" : "S17",
    rules.blackjackPayout,
    rules.doubleAfterSplit ? "DAS" : "No DAS",
    rules.surrender === "late" ? "Late surrender" : "No surrender",
    rules.maxSplits === 0 ? "No splitting" : `${rules.maxSplits} splits`,
  ].join(" · ");
}

function clampMaxSplits(n: number): number {
  return Math.min(MAX_SPLITS_CAP, Math.max(0, Math.round(n)));
}

export function sanitizeHouseRules(rules: Partial<HouseRules>): HouseRules {
  return {
    ...DEFAULT_HOUSE_RULES,
    ...rules,
    maxSplits: clampMaxSplits(rules.maxSplits ?? DEFAULT_HOUSE_RULES.maxSplits),
  };
}

export function getHouseRules(): HouseRules {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_HOUSE_RULES;
    return sanitizeHouseRules(JSON.parse(raw) as Partial<HouseRules>);
  } catch {
    return DEFAULT_HOUSE_RULES;
  }
}

export function saveHouseRules(rules: HouseRules): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizeHouseRules(rules)));
  } catch {
    // storage full or unavailable — silently skip
  }
}
