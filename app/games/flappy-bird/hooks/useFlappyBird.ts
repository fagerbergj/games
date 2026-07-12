"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FlappyBirdState, GamePhase } from "../lib/types";
import {
  createInitialState,
  advanceGameFrame,
  resetGame as resetGameState,
  flap as flapAction,
  DEFAULT_GRAVITY,
  DEFAULT_PIPE_SPEED,
  DEFAULT_BIRD_SIZE,
  DEFAULT_GROUND_HEIGHT,
  DEFAULT_PIPE_GAP_HEIGHT,
} from "../lib/game-logic";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const FRAME_RATE_MS = 1000 / 60;

export function useFlappyBird() {
  const [state, setState] = useState<FlappyBirdState | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  // Mutable ref holding latest state for the game loop to read without render-side sync
  const stateRef = useRef<FlappyBirdState | null>(null);

  // Keep ref in sync whenever state changes (side-effect, not render logic)
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const initializeGame = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    const initial = createInitialState(CANVAS_WIDTH, CANVAS_HEIGHT);
    setState(initial);
    lastTimeRef.current = 0;
  }, []);

  const startPlaying = useCallback(() => {
    if (!stateRef.current || stateRef.current.phase !== "setup") return;
    setState((prev) => (prev ? { ...prev, phase: "playing" as GamePhase } : null));
  }, []);

  // Game loop function — defined before any caller to avoid forward-reference errors
  const runGameLoop = useCallback(() => {
    if (animFrameRef.current) return; // already running
    const loop = (currentTime: number) => {
      // Read current state from the ref — always gets latest value
      const current = stateRef.current;
      if (!current || current.phase !== "playing") {
        animFrameRef.current = null;
        return;
      }

      // Accumulate time and advance frames
      const delta = currentTime - lastTimeRef.current;
      if (delta >= FRAME_RATE_MS) {
        lastTimeRef.current = currentTime - (delta % FRAME_RATE_MS);
        setState((prev) => {
          if (!prev || prev.phase !== "playing") return prev;
          return advanceGameFrame(
            prev,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            DEFAULT_GRAVITY,
            DEFAULT_PIPE_SPEED,
            DEFAULT_BIRD_SIZE,
            DEFAULT_GROUND_HEIGHT,
            DEFAULT_PIPE_GAP_HEIGHT,
          );
        });
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, []);

  const flapBird = useCallback(() => {
    setState((prev) => {
      if (!prev || prev.phase !== "playing") return prev;
      return { ...prev, bird: flapAction(prev.bird) };
    });
    // Start the animation loop on first flap
    if (!animFrameRef.current) {
      lastTimeRef.current = performance.now();
      runGameLoop();
    }
  }, [runGameLoop]);

  const resetGame = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setState((prev) => {
      if (!prev) return createInitialState(CANVAS_WIDTH, CANVAS_HEIGHT);
      return resetGameState(prev, CANVAS_WIDTH, CANVAS_HEIGHT);
    });
    lastTimeRef.current = 0;
  }, []);

  return {
    state,
    setState,
    initializeGame,
    startPlaying,
    flapBird,
    resetGame,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
  };
}
