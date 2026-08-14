"use client"

import { useBlackjack } from "./hooks/useBlackjack";
import DealerHand from "./components/dealer-hand";
import PlayerHand from "./components/player-hand";
import ActionArea from "./components/action-area";
import BankrollTray from "./components/bankroll-tray";

export default function GamePage() {
  const { state, placeBet, hit, stand, resetGame, resetBankroll } = useBlackjack();

  if (!state) return null;

  // Mid-hand only -- at result the deal-again button in ActionArea is the one canonical control.
  const showHeaderReset = state.phase === "playerTurn" || state.phase === "dealerTurn";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-400">Blackjack</h1>
          <div className="flex items-center gap-3">
            <BankrollTray bankroll={state.bankroll} />
            {showHeaderReset && (
              <button
                type="button"
                onClick={resetGame}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded-lg text-sm"
              >
                New Hand
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-3 sm:p-6">
        <div
          data-testid="felt-table"
          className="relative w-full max-w-4xl rounded-[2rem] sm:rounded-[2.5rem] border-4 sm:border-8 border-zinc-900 shadow-2xl px-3 sm:px-10 py-6 sm:py-10 flex flex-col gap-5 sm:gap-8 bg-[radial-gradient(ellipse_at_center,_#0f3d24_0%,_#0a2c1a_60%,_#071f12_100%)]"
        >
          {/* Shoe, implied */}
          <div className="hidden sm:block absolute top-8 right-8 -rotate-6 opacity-60 pointer-events-none">
            <div className="w-10 h-14 rounded bg-zinc-800 border border-zinc-700 shadow" />
            <div className="w-10 h-14 rounded bg-zinc-800 border border-zinc-700 shadow -mt-12 ml-1.5" />
          </div>

          <DealerHand cards={state.dealerHand} />

          <div className="min-h-[9rem] flex items-center justify-center border-y border-white/10 py-4">
            <ActionArea state={state} onBet={placeBet} onHit={hit} onStand={stand} onDealAgain={resetGame} />
          </div>

          <PlayerHand cards={state.playerHand} />

          {state.phase === "result" && state.bankroll <= 0 && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={resetBankroll}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-6 rounded-lg text-sm"
              >
                Reset Bankroll
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
