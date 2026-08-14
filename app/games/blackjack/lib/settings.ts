import { DECK_COUNT_OPTIONS, DEFAULT_DECK_COUNT } from "./shoe";

// Lives next to blackjack_bankroll (see bankroll.ts) so both survive reloads together.
const DECK_COUNT_KEY = "blackjack_deck_count";
const COUNT_VISIBLE_KEY = "blackjack_count_visible";

export function getDeckCount(): number {
  try {
    const raw = localStorage.getItem(DECK_COUNT_KEY);
    const n = parseInt(raw ?? "", 10);
    return (DECK_COUNT_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_DECK_COUNT;
  } catch {
    return DEFAULT_DECK_COUNT;
  }
}

export function saveDeckCount(value: number): void {
  try {
    localStorage.setItem(DECK_COUNT_KEY, String(value));
  } catch {
    // storage full or unavailable — silently skip
  }
}

// Practice mode: hidden by default so the player counts for themselves first.
export function getCountVisible(): boolean {
  try {
    return localStorage.getItem(COUNT_VISIBLE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveCountVisible(value: boolean): void {
  try {
    localStorage.setItem(COUNT_VISIBLE_KEY, String(value));
  } catch {
    // storage full or unavailable — silently skip
  }
}
