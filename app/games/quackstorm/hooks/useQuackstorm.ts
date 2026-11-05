"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  chooseGate, createLevel, levelCount, setAim, setHolding, step,
  type QuackstormState, type Phase,
} from "@game-rules/quackstorm";
import { drawGame } from "../lib/draw";

const STEP_MS = 1000 / 60;
const MAX_LAG_MS = 250;

export interface QuackstormControls {
  phase: Phase;
  stars: number;
  level: number;
  levelCount: number;
  narrator: string;
  choice: { label: string }[];
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  choose: (index: 0 | 1) => void;
  replay: () => void;
  next: () => void;
}

export function useQuackstorm(initialLevel = 1): QuackstormControls {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<QuackstormState | null>(null);
  const aimRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("choice");
  const [stars, setStars] = useState(0);
  const [level, setLevel] = useState(initialLevel);
  const [narrator, setNarrator] = useState("");
  const [choice, setChoice] = useState<{ label: string }[]>([]);

  const start = useCallback((lvl: number) => {
    const clamped = Math.min(Math.max(lvl, 1), levelCount);
    stateRef.current = createLevel(clamped, 1234 + clamped);
    setLevel(clamped);
    setPhase("choice");
    setStars(0);
    setNarrator(stateRef.current.narrator);
    setChoice(stateRef.current.choice.map((c) => ({ label: c.label })));
  }, []);

  // The simulation: a fixed-step loop that advances the engine and paints the canvas.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const st = stateRef.current;
      const canvas = canvasRef.current;
      if (!st || !canvas) return;
      acc = Math.min(acc + (now - last), MAX_LAG_MS);
      last = now;
      while (acc >= STEP_MS && stateRef.current) {
        acc -= STEP_MS;
        if (stateRef.current.phase === "playing") stateRef.current = step(stateRef.current);
      }
      const cur = stateRef.current!;
      if (cur.phase !== phase || (cur.phase === "won" && cur.stars !== stars)) {
        setPhase(cur.phase);
        setStars(cur.stars);
      }
      const ctx = canvas.getContext("2d");
      if (ctx) drawGame(ctx, canvas.width, canvas.height, cur);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, stars]);

  const worldX = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * 100;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const st = stateRef.current;
      if (!st) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      stateRef.current = setAim(st, worldX(e));
      stateRef.current = setHolding(stateRef.current, true);
      aimRef.current = true;
    },
    [worldX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const st = stateRef.current;
      if (!st || !aimRef.current) return;
      stateRef.current = setAim(st, worldX(e));
    },
    [worldX],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const st = stateRef.current;
    aimRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    if (st) stateRef.current = setHolding(st, false);
  }, []);

  const choose = useCallback(
    (index: 0 | 1) => {
      const st = stateRef.current;
      if (st && st.phase === "choice") {
        stateRef.current = chooseGate(st, index);
        // The engine has already switched to "playing": reflect it in the same
        // commit as the click, not on the next animation frame, so the choice
        // overlay unmounts before it can swallow a press meant for the canvas.
        setPhase("playing");
      }
    },
    [],
  );

  const replay = useCallback(() => start(level), [start, level]);
  const next = useCallback(() => start(level + 1), [start, level]);

  // Seed the first level on mount.
  useEffect(() => {
    if (!stateRef.current) start(initialLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { phase, stars, level, levelCount, narrator, choice, canvasRef, onPointerDown, onPointerMove, onPointerUp, choose, replay, next };
}
