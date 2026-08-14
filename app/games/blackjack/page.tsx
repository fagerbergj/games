"use client"

import { useState } from "react";
import { useBlackjack } from "./hooks/useBlackjack";
import { isBlackjack } from "./lib/engine";
import DealerHand from "./components/dealer-hand";
import SeatPanel from "./components/seat-panel";
import RulesPanel from "./components/rules-panel";

export default function GamePage() {
  const {
    state, placeBet, setSeatCount, setHouseRules,
    hit, stand, double, split, surrender,
    takeInsurance, declineInsurance, takeEvenMoney,
    resetRound, resetSeatBankroll, buyBackIn, actions,
    deckCount, setDeckCount, justReshuffled,
    runningCount, trueCount, decksRemaining, lastCountedCard, countVisible, toggleCountVisible,
  } = useBlackjack(1);

  // Only one seat's count popover open at a time, anchored to whichever seat triggered it.
  const [countPopoverSeat, setCountPopoverSeat] = useState<number | null>(null);

  const { phase, seats, dealerHand, activeSeatIndex, houseRules } = state;
  const dealerHasBlackjack = phase === "result" && isBlackjack(dealerHand);
  // Mid-hand only -- at result the New Round button below is the one canonical reset control.
  const showHeaderReset = phase === "insurance" || phase === "playerTurns" || phase === "dealerTurn";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="bg-zinc-900 border-b border-zinc-800 p-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-400">Blackjack</h1>
          {showHeaderReset && (
            <button
              type="button"
              onClick={resetRound}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded-lg text-sm"
            >
              New Hand
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-3">
        {/* min-h (not h) so the felt holds one stable height on desktop viewports without
            clipping the rare tallest case (3 seats, one split) -- that's left to overflow
            and scroll instead. Uncapped on mobile: there's no spare vertical budget there,
            so the page should flow and scroll like any normal page. */}
        <div
          data-testid="felt-table"
          className="relative w-full max-w-6xl sm:min-h-[min(51.5rem,calc(100vh-4.5rem))] rounded-[2rem] sm:rounded-[2.5rem] border-4 sm:border-8 border-zinc-900 shadow-2xl px-3 sm:px-10 py-3 sm:py-4 flex flex-col gap-2 sm:gap-3 bg-[radial-gradient(ellipse_at_center,_#0f3d24_0%,_#0a2c1a_60%,_#071f12_100%)]"
        >
          {/* Fixed-height row regardless of phase -- the trigger pill itself is only
              actionable during betting, but its row never collapses/reappears. */}
          <div className="h-8 flex items-center justify-center">
            {phase === "betting" && (
              <RulesPanel
                rules={houseRules}
                seatCount={seats.length}
                deckCount={deckCount}
                onRulesChange={setHouseRules}
                onSeatCountChange={setSeatCount}
                onDeckCountChange={setDeckCount}
              />
            )}
          </div>

          {/* Dealer zone and status line render every phase (ghost cards / blank line while
              betting) so dealing in doesn't add ~150px and re-center the whole table. */}
          <DealerHand cards={dealerHand} />
          <p className="text-zinc-400 text-sm text-center h-5">
            {phase === "betting" && "Place your bets"}
            {phase === "insurance" && "Insurance — dealer shows an ace"}
            {phase === "playerTurns" && `${seats[activeSeatIndex]?.label ?? ""}'s turn`}
            {phase === "dealerTurn" && "Dealer's turn"}
            {phase === "result" && "Round over"}
          </p>

          <div className={`grid gap-4 ${seats.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""} border-t border-white/10 pt-2`}>
            {seats.map((seat, i) => (
              <SeatPanel
                key={seat.id}
                seat={seat}
                phase={phase}
                isActiveSeat={phase === "playerTurns" ? i === activeSeatIndex : true}
                actions={phase === "playerTurns" && i === activeSeatIndex ? actions : null}
                dealerUpCard={dealerHand[0]}
                dealerHasBlackjack={dealerHasBlackjack}
                houseRules={houseRules}
                trueCount={trueCount}
                onPlaceBet={amount => placeBet(i, amount)}
                onHit={hit} onStand={stand} onDouble={double} onSplit={split} onSurrender={surrender}
                onTakeInsurance={amount => takeInsurance(i, amount)}
                onDeclineInsurance={() => declineInsurance(i)}
                onTakeEvenMoney={() => takeEvenMoney(i)}
                onResetBankroll={() => resetSeatBankroll(i)}
                onBuyBackIn={() => buyBackIn(i)}
                onResetRound={i === 0 ? resetRound : undefined}
                runningCount={runningCount}
                decksRemaining={decksRemaining}
                lastCountedCard={lastCountedCard}
                countVisible={countVisible}
                onToggleCountVisible={toggleCountVisible}
                justReshuffled={justReshuffled}
                countOpen={countPopoverSeat === i}
                onToggleCount={() => setCountPopoverSeat(s => (s === i ? null : i))}
                onCloseCount={() => setCountPopoverSeat(s => (s === i ? null : s))}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
