const KEY = "blackjack_bankroll";
const SEATS_KEY = "blackjack_seat_bankrolls";
export const STARTING_BANKROLL = 500;

export function getBankroll(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : STARTING_BANKROLL;
  } catch {
    return STARTING_BANKROLL;
  }
}

export function saveBankroll(value: number): void {
  try {
    localStorage.setItem(KEY, String(Math.max(0, value)));
  } catch {
    // storage full or unavailable — silently skip
  }
}

/**
 * Per-seat bankrolls for the multi-seat table. Seat 0 falls back to the legacy
 * single-hand bankroll key so an existing player's balance carries over.
 */
export function getSeatBankrolls(count: number): number[] {
  let stored: number[] = [];
  try {
    const raw = localStorage.getItem(SEATS_KEY);
    if (raw) stored = JSON.parse(raw) as number[];
  } catch {
    stored = [];
  }

  return Array.from({ length: count }, (_, i) => {
    const v = stored[i];
    if (Number.isFinite(v) && v >= 0) return v;
    return i === 0 ? getBankroll() : STARTING_BANKROLL;
  });
}

export function saveSeatBankrolls(bankrolls: number[]): void {
  try {
    localStorage.setItem(SEATS_KEY, JSON.stringify(bankrolls.map(v => Math.max(0, v))));
    if (bankrolls.length > 0) saveBankroll(bankrolls[0]);
  } catch {
    // storage full or unavailable — silently skip
  }
}
