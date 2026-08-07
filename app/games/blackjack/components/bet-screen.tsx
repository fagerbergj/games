"use client"

import { useState, useCallback } from "react";

const PRESETS = [10, 25, 50, 100, 250];

interface Props {
  bankroll: number;
  onBet: (amount: number) => void;
}

export default function BetScreen({ bankroll, onBet }: Props) {
  const [betStr, setBetStr] = useState("");

  const preset = useCallback((p: number) => {
    if (p <= bankroll) setBetStr(String(p));
  }, [bankroll]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBetStr(e.target.value);
  };

  const confirm = () => {
    const n = parseInt(betStr, 10);
    if (Number.isFinite(n) && n >= 1 && n <= bankroll) onBet(n);
  };

  const bet = parseInt(betStr, 10);
  const valid = Number.isFinite(bet) && bet >= 1 && bet <= bankroll;

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div>
        <span className="text-zinc-400 text-sm">Bankroll</span>
        <p className="text-4xl font-bold text-yellow-400 mt-1">${bankroll}</p>
      </div>

      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 w-full max-w-sm">
        <label className="block text-zinc-300 text-sm mb-2 text-center">Place Your Bet</label>
        <input
          type="number"
          min={1}
          max={bankroll}
          value={betStr}
          onChange={handleInput}
          placeholder="Amount"
          className="w-full text-center text-2xl font-bold bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white mb-4 focus:outline-none focus:border-yellow-500"
        />

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => preset(p)}
              disabled={p > bankroll}
              className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 border border-zinc-700 text-sm px-4 py-2 rounded-lg text-zinc-300"
            >
              ${p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => preset(bankroll)}
            disabled={bankroll <= 0}
            className="bg-red-900 hover:bg-red-800 disabled:opacity-30 border border-red-700 text-sm px-4 py-2 rounded-lg text-red-300"
          >
            All-In
          </button>
        </div>

        <div className="text-center mb-2">
          <span className="text-zinc-400">Current: </span>
          <span className={`font-bold ${valid ? "text-zinc-100" : "text-zinc-500"}`}>
            {valid ? `$${bet}` : "$0"}
          </span>
        </div>

        <button
          type="button"
          disabled={!valid}
          onClick={confirm}
          className={`w-full py-3 rounded-lg font-bold text-lg transition-colors ${
            valid
              ? "bg-yellow-500 hover:bg-yellow-600 text-black"
              : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
          }`}
        >
          Deal Cards
        </button>
      </div>
    </div>
  );
}
