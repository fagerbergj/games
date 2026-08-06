const KEY = "blackjack_bankroll";

export function getBankroll(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : 500;
  } catch {
    return 500;
  }
}

export function saveBankroll(value: number): void {
  try {
    localStorage.setItem(KEY, String(Math.max(0, value)));
  } catch {
    // storage full or unavailable — silently skip
  }
}
