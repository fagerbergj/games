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
      className="w-full block rounded-xl touch-none select-none mx-auto"
      style={{
        aspectRatio: "3 / 5",
        touchAction: "none",
        // Cap the width by the viewport height too, so the cannon strip is never
        // clipped off the bottom on short desktop windows (1280x800 et al).
        width: "min(100%, calc((100vh - 120px) * 0.6), calc((100dvh - 120px) * 0.6))",
      }}
    />
  );
}
