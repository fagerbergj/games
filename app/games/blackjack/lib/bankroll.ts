const KEY = "blackjack_bankroll";

export const DEFAULT_BANKROLL = 500;

export function getBankroll(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_BANKROLL;
  } catch {
    return DEFAULT_BANKROLL;
  }
}

export function saveBankroll(value: number): void {
  try {
    localStorage.setItem(KEY, String(Math.max(0, value)));
  } catch {
    // storage full or unavailable — silently skip
  }
}
