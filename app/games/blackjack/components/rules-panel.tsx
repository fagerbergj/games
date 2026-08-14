"use client"

import { useState } from "react"
import { HOUSE_RULE_LABELS, MAX_SPLITS_CAP, summarizeHouseRules } from "../lib/houseRules"
import { DECK_COUNT_OPTIONS } from "../lib/shoe"
import type { HouseRules } from "../lib/types"
import { MIN_SEATS, MAX_SEATS } from "../hooks/useBlackjack"

interface Props {
  rules: HouseRules
  seatCount: number
  deckCount: number
  onRulesChange: (rules: HouseRules) => void
  onSeatCountChange: (n: number) => void
  onDeckCountChange: (n: number) => void
}

function Field({ id, children }: { id: string; children: React.ReactNode }) {
  const meta = HOUSE_RULE_LABELS[id as keyof HouseRules]
  return (
    <div className="flex flex-col gap-1 py-2 border-b border-zinc-800 last:border-0">
      <div className="flex items-center justify-between gap-4">
        <span className="text-zinc-200 text-sm font-medium">{meta.title}</span>
        {children}
      </div>
      <p className="text-xs text-zinc-500">{meta.blurb}</p>
    </div>
  )
}

export default function RulesPanel({ rules, seatCount, deckCount, onRulesChange, onSeatCountChange, onDeckCountChange }: Props) {
  // Never persisted -- reopens collapsed every load, same as a real table's rules card.
  const [expanded, setExpanded] = useState(false)
  const set = <K extends keyof HouseRules>(key: K, value: HouseRules[K]) =>
    onRulesChange({ ...rules, [key]: value })

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-full px-4 py-1.5 text-xs text-zinc-300"
      >
        <span aria-hidden>⚙</span>
        <span className="font-semibold">Table rules</span>
        {!expanded && <span className="text-zinc-500">— {summarizeHouseRules(rules, deckCount)}</span>}
      </button>

      {expanded && (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 w-full text-sm">
      <h2 className="text-zinc-100 font-bold mb-2">Table Settings</h2>

      <div className="flex flex-col gap-1 py-2 border-b border-zinc-800">
        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-200 text-sm font-medium">Decks</span>
          <div className="flex gap-1.5">
            {DECK_COUNT_OPTIONS.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => onDeckCountChange(n)}
                aria-pressed={deckCount === n}
                className={`text-xs px-2.5 py-1 rounded-md border ${
                  deckCount === n
                    ? "bg-yellow-500 border-yellow-500 text-black font-bold"
                    : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-500">Changing this shuffles a fresh shoe</p>
      </div>

      <div className="flex flex-col gap-1 py-2 border-b border-zinc-800">
        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-200 text-sm font-medium">Seats</span>
          <select
            value={seatCount}
            onChange={e => onSeatCountChange(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
          >
            {Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => MIN_SEATS + i).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-zinc-500">How many hot-seat players share this table (1-{MAX_SEATS}).</p>
      </div>

      <Field id="dealerHitsSoft17">
        <select
          value={rules.dealerHitsSoft17 ? "H17" : "S17"}
          onChange={e => set("dealerHitsSoft17", e.target.value === "H17")}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
        >
          <option value="S17">S17 (stands)</option>
          <option value="H17">H17 (hits)</option>
        </select>
      </Field>

      <Field id="blackjackPayout">
        <select
          value={rules.blackjackPayout}
          onChange={e => set("blackjackPayout", e.target.value as HouseRules["blackjackPayout"])}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
        >
          <option value="3:2">3:2 (standard)</option>
          <option value="6:5">6:5 (bad for you)</option>
        </select>
      </Field>

      <Field id="doubleAfterSplit">
        <input
          type="checkbox"
          checked={rules.doubleAfterSplit}
          onChange={e => set("doubleAfterSplit", e.target.checked)}
          className="w-4 h-4"
        />
      </Field>

      <Field id="doubleRestriction">
        <select
          value={rules.doubleRestriction}
          onChange={e => set("doubleRestriction", e.target.value as HouseRules["doubleRestriction"])}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
        >
          <option value="any2">Any two cards</option>
          <option value="9-11">9, 10, or 11 only</option>
        </select>
      </Field>

      <Field id="surrender">
        <select
          value={rules.surrender}
          onChange={e => set("surrender", e.target.value as HouseRules["surrender"])}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
        >
          <option value="none">None</option>
          <option value="late">Late surrender</option>
        </select>
      </Field>

      <Field id="insuranceEnabled">
        <input
          type="checkbox"
          checked={rules.insuranceEnabled}
          onChange={e => set("insuranceEnabled", e.target.checked)}
          className="w-4 h-4"
        />
      </Field>

      <Field id="maxSplits">
        <select
          value={rules.maxSplits}
          onChange={e => set("maxSplits", Number(e.target.value))}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
        >
          {Array.from({ length: MAX_SPLITS_CAP + 1 }, (_, n) => n).map(n => (
            <option key={n} value={n}>{n === 0 ? "0 (no splitting)" : `${n} (${n + 1} hands)`}</option>
          ))}
        </select>
      </Field>

      <Field id="splitAcesOneCardOnly">
        <input
          type="checkbox"
          checked={rules.splitAcesOneCardOnly}
          onChange={e => set("splitAcesOneCardOnly", e.target.checked)}
          className="w-4 h-4"
        />
      </Field>

      <Field id="dealerPeek">
        <select
          value={rules.dealerPeek}
          onChange={e => set("dealerPeek", e.target.value as HouseRules["dealerPeek"])}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100"
        >
          <option value="peek">Peek</option>
          <option value="noPeek">No peek</option>
          <option value="enhc">ENHC (European no hole card)</option>
        </select>
      </Field>
    </div>
      )}
    </div>
  )
}
