import { updateBankroll } from "../lib/engine";
import { getBankroll, saveBankroll } from "../lib/bankroll";

/* ------------------------------------------------------------------ */
/*  updateBankroll — pure arithmetic                                   */
/* ------------------------------------------------------------------ */

describe("updateBankroll", () => {
  test("win normal — balance increases by bet",   ()     => { expect(updateBankroll(500, 100)).toBe(600); });
  test("loss — balance decreases by bet",          ()     => { expect(updateBankroll(500, -100)).toBe(400); });
  test("push — no change",                         ()     => { expect(updateBankroll(500, 0 )).toBe(500); });
  test("blackjack win (+bet*1.5)",                 ()     => { expect(updateBankroll(500, 250)).toBe(750); });
  test("clamped at zero — overshoot from low balance", ()   => { expect(updateBankroll(30, -60)).toBe(0); });
});

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
