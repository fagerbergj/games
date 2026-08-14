"use client"

import { useBlackjack } from "./hooks/useBlackjack";
import DealerHand from "./components/dealer-hand";
import SeatPanel from "./components/seat-panel";
import RulesPanel from "./components/rules-panel";
import DeckSelector from "./components/deck-selector";
import CountPanel from "./components/count-panel";

export default function GamePage() {
  const {
    state, placeBet, setSeatCount, setHouseRules, startRound,
    hit, stand, double, split, surrender,
    takeInsurance, declineInsurance, takeEvenMoney,
    resetRound, resetSeatBankroll, actions,
    deckCount, setDeckCount, justReshuffled,
    runningCount, trueCount, decksRemaining, lastCountedCard, countVisible, toggleCountVisible,
  } = useBlackjack(1);

  const { phase, seats, dealerHand, activeSeatIndex, houseRules } = state;
  const allBetsPlaced = seats.every(s => s.pendingBet > 0);
  // Mid-hand only -- at result the New Round button below is the one canonical reset control.
  const showHeaderReset = phase === "insurance" || phase === "playerTurns" || phase === "dealerTurn";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4">
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

      <main className="flex-1 flex items-center justify-center p-3 sm:p-6">
        <div
          data-testid="felt-table"
          className="relative w-full max-w-6xl rounded-[2rem] sm:rounded-[2.5rem] border-4 sm:border-8 border-zinc-900 shadow-2xl px-3 sm:px-10 py-6 sm:py-10 flex flex-col gap-5 sm:gap-8 bg-[radial-gradient(ellipse_at_center,_#0f3d24_0%,_#0a2c1a_60%,_#071f12_100%)]"
        >
          {/* In normal flow (not absolutely positioned) so it never collides with the
              deck selector / rules panel above it at any viewport width. */}
          <div className="flex justify-center sm:justify-end">
            <CountPanel
              runningCount={runningCount}
              trueCountValue={trueCount}
              decksLeft={decksRemaining}
              lastCountedCard={lastCountedCard}
              visible={countVisible}
              onToggle={toggleCountVisible}
              justReshuffled={justReshuffled}
            />
          </div>

          {phase === "betting" ? (
            <div className="flex flex-col items-center gap-4">
              <DeckSelector deckCount={deckCount} onChange={setDeckCount} />
              <RulesPanel
                rules={houseRules}
                seatCount={seats.length}
                onRulesChange={setHouseRules}
                onSeatCountChange={setSeatCount}
              />
            </div>
          ) : (
            <>
              <DealerHand cards={dealerHand} />
              <p className="text-zinc-400 text-sm text-center">
                {phase === "insurance" && "Insurance — dealer shows an ace"}
                {phase === "playerTurns" && `${seats[activeSeatIndex]?.label ?? ""}'s turn`}
                {phase === "dealerTurn" && "Dealer's turn"}
                {phase === "result" && "Round over"}
              </p>
            </>
          )}

          <div className={`grid gap-4 ${seats.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""} border-t border-white/10 pt-5`}>
            {seats.map((seat, i) => (
              <SeatPanel
                key={seat.id}
                seat={seat}
                phase={phase}
                isActiveSeat={phase === "playerTurns" ? i === activeSeatIndex : true}
                actions={phase === "playerTurns" && i === activeSeatIndex ? actions : null}
                dealerUpCard={dealerHand[0]}
                onPlaceBet={amount => placeBet(i, amount)}
                onHit={hit} onStand={stand} onDouble={double} onSplit={split} onSurrender={surrender}
                onTakeInsurance={amount => takeInsurance(i, amount)}
                onDeclineInsurance={() => declineInsurance(i)}
                onTakeEvenMoney={() => takeEvenMoney(i)}
                onResetBankroll={() => resetSeatBankroll(i)}
              />
            ))}
          </div>

          {phase === "betting" && allBetsPlaced && (
            <button onClick={startRound}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-lg text-lg self-center">
              Deal
            </button>
          )}

          {phase === "result" && (
            <button onClick={resetRound}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-lg text-lg self-center">
              New Round
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
