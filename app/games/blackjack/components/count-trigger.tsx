"use client"
import { usePopoverDismiss } from "../hooks/usePopoverDismiss"
import CountPanel from "./count-panel"
import type { Card } from "../lib/types"

interface Props {
  runningCount: number
  trueCountValue: number
  decksLeft: number
  lastCountedCard?: { card: Card; delta: number }
  visible: boolean
  onToggleVisible: () => void
  justReshuffled: boolean
  open: boolean
  onToggle: () => void
  onClose: () => void
}

/**
 * Compact trigger for the card-count panel, anchored right beside whichever controls
 * the seat is using — betting chips or the action buttons — instead of a fixed corner box.
 * Opens as an absolutely-positioned overlay so it never reflows the felt underneath.
 */
export default function CountTrigger({ open, onToggle, onClose, ...count }: Props) {
  const { triggerRef, panelRef } = usePopoverDismiss<HTMLButtonElement>(open, onClose)

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label="Card count"
        className="h-11 px-4 flex items-center text-sm bg-black/30 hover:bg-black/40 border border-white/10 rounded-full text-zinc-300 font-semibold"
      >
        Count
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute z-30 bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 max-w-[85vw]"
        >
          <CountPanel
            runningCount={count.runningCount}
            trueCountValue={count.trueCountValue}
            decksLeft={count.decksLeft}
            lastCountedCard={count.lastCountedCard}
            visible={count.visible}
            onToggle={count.onToggleVisible}
            justReshuffled={count.justReshuffled}
          />
        </div>
      )}
    </div>
  )
}
