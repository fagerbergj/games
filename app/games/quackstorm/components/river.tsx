"use client";

import { useEffect } from "react";
import type { QuackstormControls } from "../hooks/useQuackstorm";

/** The canvas the engine paints onto, plus the drag/hold input surface. */
export default function River({ canvasRef, onPointerDown, onPointerMove, onPointerUp }: QuackstormControls) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="w-full block rounded-xl touch-none select-none"
      style={{ aspectRatio: "3 / 5", touchAction: "none" }}
    />
  );
}
