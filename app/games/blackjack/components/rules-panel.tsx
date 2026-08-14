"use client"

import { useId, useRef, useState } from "react"
import { HOUSE_RULE_LABELS, MAX_SPLITS_CAP, summarizeHouseRules } from "../lib/houseRules"
import { DECK_COUNT_OPTIONS } from "../lib/shoe"
import type { HouseRules } from "../lib/types"
import { MIN_SEATS, MAX_SEATS } from "../hooks/useBlackjack"
import { usePopoverDismiss } from "../hooks/usePopoverDismiss"

interface Props {
  rules: HouseRules
  seatCount: number
  deckCount: number
  onRulesChange: (rules: HouseRules) => void
  onSeatCountChange: (n: number) => void
  onDeckCountChange: (n: number) => void
}

const TABS = ["table", "doubling", "surrender"] as const
type TabId = (typeof TABS)[number]
const TAB_LABEL: Record<TabId, string> = {
  table: "Table",
  doubling: "Doubling & splitting",
  surrender: "Surrender & insurance",
}

function Field({ id, children }: { id: keyof HouseRules; children: React.ReactNode }) {
  const meta = HOUSE_RULE_LABELS[id]
  return (
    <div className="flex flex-col gap-0.5 py-1.5 border-b border-zinc-800/60 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-zinc-200 text-xs font-medium">{meta.title}</span>
        {children}
      </div>
      <p className="text-[11px] leading-snug text-zinc-500">{meta.blurb}</p>
    </div>
  )
}

const selectClass = "bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-100"
const checkboxClass = "w-3.5 h-3.5"

export default function RulesPanel({ rules, seatCount, deckCount, onRulesChange, onSeatCountChange, onDeckCountChange }: Props) {
  // Never persisted -- reopens collapsed every load, same as a real table's rules card.
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabId>("table")
  const uid = useId()
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

  const close = () => setOpen(false)
  const { triggerRef, panelRef, requestClose } = usePopoverDismiss<HTMLButtonElement>(open, close)

  const set = <K extends keyof HouseRules>(key: K, value: HouseRules[K]) =>
    onRulesChange({ ...rules, [key]: value })

  function focusTab(id: TabId) {
    setTab(id)
    tabRefs.current[id]?.focus()
  }

  function onTabKeyDown(e: React.KeyboardEvent) {
    const idx = TABS.indexOf(tab)
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault()
      focusTab(TABS[(idx + 1) % TABS.length])
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault()
      focusTab(TABS[(idx - 1 + TABS.length) % TABS.length])
    } else if (e.key === "Home") {
      e.preventDefault()
      focusTab(TABS[0])
    } else if (e.key === "End") {
      e.preventDefault()
      focusTab(TABS[TABS.length - 1])
    }
  }

  return (
    // No positioning wrapper around the trigger -- the scrim/dialog below anchor against
    // the felt (the nearest actually-positioned ancestor), not a box sized to the pill.
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Table rules"
        className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-full px-4 py-1.5 text-xs text-zinc-300"
      >
        <span aria-hidden>⚙</span>
        <span className="font-semibold">Table rules</span>
        <span className="text-zinc-500">— {summarizeHouseRules(rules, deckCount)}</span>
      </button>

      {open && (
        <>
          {/* Scoped to the felt (nearest positioned ancestor), never the viewport -- a
              full-screen backdrop is exactly what this project removed the last one for. */}
          <div
            className="absolute inset-0 z-40 rounded-[2rem] sm:rounded-[2.5rem] bg-black/50"
            onClick={requestClose}
            aria-hidden
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={`${uid}-title`}
            className="absolute z-50 inset-x-4 top-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[26rem] bg-zinc-900 border border-zinc-800 rounded-xl p-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 id={`${uid}-title`} className="text-zinc-100 font-bold text-sm">Table Settings</h2>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close table rules"
                className="text-zinc-500 hover:text-zinc-200 text-lg leading-none px-1"
              >
                &times;
              </button>
            </div>

            <div role="tablist" aria-label="Table rules categories" className="flex gap-1 mb-2">
              {TABS.map(t => (
                <button
                  key={t}
                  ref={el => { tabRefs.current[t] = el }}
                  role="tab"
                  id={`${uid}-tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`${uid}-panel-${t}`}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => setTab(t)}
                  onKeyDown={onTabKeyDown}
                  className={`flex-1 text-center text-[11px] leading-tight px-1.5 py-1.5 rounded-md ${
                    tab === t ? "bg-yellow-500 text-black font-bold" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>

            {/* Fixed height so switching tabs never resizes the dialog (same reasoning as
                the felt underneath: content swaps in place instead of moving anything). */}
            <div className="h-[18rem] overflow-y-auto text-sm">
              <div
                role="tabpanel"
                id={`${uid}-panel-table`}
                aria-labelledby={`${uid}-tab-table`}
                hidden={tab !== "table"}
              >
                <div className="flex flex-col gap-0.5 py-1.5 border-b border-zinc-800/60">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-200 text-xs font-medium">Decks</span>
                    <div className="flex gap-1">
                      {DECK_COUNT_OPTIONS.map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => onDeckCountChange(n)}
                          aria-pressed={deckCount === n}
                          className={`text-[11px] px-2 py-0.5 rounded-md border ${
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
                  <p className="text-[11px] leading-snug text-zinc-500">Changing this shuffles a fresh shoe</p>
                </div>

                <div className="flex flex-col gap-0.5 py-1.5 border-b border-zinc-800/60">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-200 text-xs font-medium">Seats</span>
                    <select
                      value={seatCount}
                      onChange={e => onSeatCountChange(Number(e.target.value))}
                      aria-label="Seats"
                      className={selectClass}
                    >
                      {Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => MIN_SEATS + i).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] leading-snug text-zinc-500">How many hot-seat players share this table (1-{MAX_SEATS}).</p>
                </div>

                <Field id="blackjackPayout">
                  <select
                    value={rules.blackjackPayout}
                    onChange={e => set("blackjackPayout", e.target.value as HouseRules["blackjackPayout"])}
                    className={selectClass}
                  >
                    <option value="3:2">3:2 (standard)</option>
                    <option value="6:5">6:5 (bad for you)</option>
                  </select>
                </Field>

                <Field id="dealerHitsSoft17">
                  <select
                    value={rules.dealerHitsSoft17 ? "H17" : "S17"}
                    onChange={e => set("dealerHitsSoft17", e.target.value === "H17")}
                    className={selectClass}
                  >
                    <option value="S17">S17 (stands)</option>
                    <option value="H17">H17 (hits)</option>
                  </select>
                </Field>

                <Field id="dealerPeek">
                  <select
                    value={rules.dealerPeek}
                    onChange={e => set("dealerPeek", e.target.value as HouseRules["dealerPeek"])}
                    className={selectClass}
                  >
                    <option value="peek">Peek</option>
                    <option value="noPeek">No peek</option>
                    <option value="enhc">ENHC (no hole card)</option>
                  </select>
                </Field>
              </div>

              <div
                role="tabpanel"
                id={`${uid}-panel-doubling`}
                aria-labelledby={`${uid}-tab-doubling`}
                hidden={tab !== "doubling"}
              >
                <Field id="doubleRestriction">
                  <select
                    value={rules.doubleRestriction}
                    onChange={e => set("doubleRestriction", e.target.value as HouseRules["doubleRestriction"])}
                    className={selectClass}
                  >
                    <option value="any2">Any two cards</option>
                    <option value="9-11">9, 10, or 11 only</option>
                  </select>
                </Field>

                <Field id="doubleAfterSplit">
                  <input
                    type="checkbox"
                    checked={rules.doubleAfterSplit}
                    onChange={e => set("doubleAfterSplit", e.target.checked)}
                    className={checkboxClass}
                  />
                </Field>

                <Field id="maxSplits">
                  <select
                    value={rules.maxSplits}
                    onChange={e => set("maxSplits", Number(e.target.value))}
                    className={selectClass}
                  >
                    {Array.from({ length: MAX_SPLITS_CAP + 1 }, (_, n) => n).map(n => (
                      <option key={n} value={n}>{n === 0 ? "0 (none)" : `${n} (${n + 1} hands)`}</option>
                    ))}
                  </select>
                </Field>

                <Field id="splitAcesOneCardOnly">
                  <input
                    type="checkbox"
                    checked={rules.splitAcesOneCardOnly}
                    onChange={e => set("splitAcesOneCardOnly", e.target.checked)}
                    className={checkboxClass}
                  />
                </Field>
              </div>

              <div
                role="tabpanel"
                id={`${uid}-panel-surrender`}
                aria-labelledby={`${uid}-tab-surrender`}
                hidden={tab !== "surrender"}
              >
                <Field id="surrender">
                  <select
                    value={rules.surrender}
                    onChange={e => set("surrender", e.target.value as HouseRules["surrender"])}
                    className={selectClass}
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
                    className={checkboxClass}
                  />
                </Field>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
