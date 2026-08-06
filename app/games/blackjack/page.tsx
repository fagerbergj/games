"use client"

import { useBlackjack } from "./hooks/useBlackjack";
import BetScreen from "./components/bet-screen";
import Card from "./components/card";
import PlayerHand from "./components/player-hand";
import DealerHand from "./components/dealer-hand";
import ActionButtons from "./components/action-buttons";

export default function GamePage() {
  const { state, placeBet, hit, stand, resetGame, resetBankroll } = useBlackjack();

  if (!state || state.phase === "betting") {
    const bankroll = state?.bankroll ?? 500;
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative">
        <header className="bg-zinc-900 border-b border-zinc-800 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold text-green-400">Blackjack</h1>
            <button onClick={resetGame} className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded-lg text-sm">New Hand</button>
          </div>
        </header>
        {state?.bankroll !== undefined && (
          <div className="absolute top-16 right-4 z-10 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1">
            <span className="text-yellow-400 font-bold">${state?.bankroll}</span>
          </div>
        )}
        <main className="flex-1 flex items-center justify-center p-4">
          <BetScreen bankroll={bankroll} onBet={placeBet} />
        </main>
      </div>
    );
  }

  const result    = state.result;
  const isDealerTurn = state.phase === "dealerTurn";
  const isPlayerTurn = state.phase === "playerTurn";
  const isResult   = state.phase === "result";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-400">Blackjack</h1>
          <button onClick={resetGame} className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded-lg text-sm">New Hand</button>
        </div>
      </header>

      {/* Bankroll bar */}
      <div className="max-w-7xl mx-auto w-full px-4 py-2 flex gap-6 items-center border-b border-zinc-800">
        <span className="text-zinc-400">Bankroll: </span>
        <span className="text-yellow-400 font-bold text-lg">${state?.bankroll}</span>
        <span className="text-zinc-500 ml-auto">Bet: ${state.bet}</span>
      </div>

      {/* Main game area */}
      {(state.dealerHand.length > 0 || state.playerHand.length > 0) ? (
        <main className="flex-1 flex flex-col items-center justify-center gap-8 px-4 py-12">
          {/* Dealer section */}
          {state.dealerHand.map(c => (
            <Card key={c.id} card={c} />
          ))}

          <p className="text-zinc-500 text-sm">{isPlayerTurn ? "Your turn" : isDealerTurn ? "Dealer's turn" : ""}</p>

          {/* Action buttons for player turn */}
          {isPlayerTurn && (
            <ActionButtons onHit={hit} onStand={stand} />
          )}

          {/* Player section */}
          {state.playerHand.length > 0 && (
            <PlayerHand cards={state.playerHand} />
          )}

          {/* Result modal for result phase */}
          {isResult && state.dealerHand.map(c => <Card key={c.id} card={c} />)}

          {isResult && result && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-10 text-center max-w-sm w-full mx-4">
                {result.result === "blackjack" && (
                  <>
                    <h2 className="text-3xl font-bold text-yellow-400 mb-3">Blackjack!</h2>
                    <p className="text-zinc-400 mb-8">You win ${result.amount}</p>
                  </>
                )}
                {result.result === "win" && (
                  <>
                    <h2 className="text-3xl font-bold text-green-400 mb-3">You Win!</h2>
                    <p className="text-zinc-400 mb-8">+${result.amount}</p>
                  </>
                )}
                {result.result === "loss" && (
        <>
          <h2 className="text-3xl font-bold text-red-400 mb-3">Dealer Wins</h2>
          <p className="text-zinc-400 mb-8">-${Math.abs(result.amount)}</p>
        </>
                )}
                {result.result === "push" && (
                  <>
                    <h2 className="text-3xl font-bold text-zinc-300 mb-3">Push</h2>
                    <p className="text-zinc-400 mb-8">Bet returned</p>
                  </>
                )}

                <div className="text-sm text-zinc-500 mb-4">Bankroll: ${state.bankroll}</div>

                <div className="flex gap-3">
                  <button onClick={resetGame} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-lg flex-1 transition-colors">New Hand</button>
                </div>
                {state.bankroll <= 0 && (
                  <button onClick={resetBankroll} className="mt-3 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">Reset Bankroll</button>
                )}
              </div>
            </div>
          )}
        </main>
      ) : null}
    </div>
  );
}

