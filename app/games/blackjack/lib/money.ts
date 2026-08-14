/** One money formatter for the whole game: no decimals when whole, exactly two when fractional. */
export function formatMoney(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const decimals = cents % 100 === 0 ? 0 : 2;
  const formatted = `$${(cents / 100).toFixed(decimals)}`;
  return amount < 0 ? `-${formatted}` : formatted;
}
