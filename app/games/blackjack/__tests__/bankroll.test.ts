import { getBankroll, saveBankroll } from "../lib/bankroll";

/* ------------------------------------------------------------------ */
/*  Bankroll store (localStorage)                                     */
/* ------------------------------------------------------------------ */

describe("save / getBankroll round-trip", () => {
  afterEach(()   => { localStorage.removeItem("blackjack_bankroll"); });

  test("default bankroll returns 500 when key missing",    ()     => { expect(getBankroll()).toBe(500); });

  test("persisted value reads back correctly",             ()     => {
    saveBankroll(1234);
    expect(getBankroll()).toBe(1234);
  });

  test("clamps negative values to zero",                   ()     => {
    saveBankroll(-50);
    expect(getBankroll()).toBe(0);
  });
});
