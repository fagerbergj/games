"use client"
import { useCallback, useEffect, useRef } from "react";

/**
 * Shared dismiss wiring for an anchored overlay (popover or floating dialog): Escape and an
 * outside click both close it, and focus returns to the trigger if it was inside the panel
 * when closed (e.g. Escape, a close button) — not on outside clicks, which have their own target.
 */
export function usePopoverDismiss<T extends HTMLElement = HTMLButtonElement>(open: boolean, onClose: () => void) {
  const triggerRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const requestClose = useCallback(() => {
    const hadFocusInside = panelRef.current?.contains(document.activeElement) ?? false;
    onClose();
    if (hadFocusInside) triggerRef.current?.focus();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      requestClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, requestClose]);

  return { triggerRef, panelRef, requestClose };
}
