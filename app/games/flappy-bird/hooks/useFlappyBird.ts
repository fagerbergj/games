import { useState, useCallback, useEffect } from "react";
import { FlappyBirdState } from "../lib/types";
import {
  createInitialState,
  step,
  jump as jumpAction,
  resetGame,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "../lib/game";

interface UseFlappyBirdReturn {
  state: FlappyBirdState;
  canvasWidth: number;
  canvasHeight: number;
  onJump: () => void;
  onStart: () => void;
  onReset: () => void;
}

export function useFlappyBird(): UseFlappyBirdReturn {
  const [state, setState] = useState<FlappyBirdState>(createInitialState);
  const canvasWidth = CANVAS_WIDTH;
  const canvasHeight = CANVAS_HEIGHT;

  // Game loop with requestAnimationFrame
  useEffect(() => {
    if (state.phase !== "playing") return;

    let animationId: number;

    const tick = () => {
      setState((prev) => {
        if (prev.phase !== "playing") return prev;
        return step(prev);
      });
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [state.phase]);

  const onJump = useCallback(() => {
    setState((prev) => jumpAction(prev));
  }, []);

  const onStart = useCallback(() => {
    if (state.phase === "ready") {
      setState((prev) => jumpAction(prev));
    } else {
      setState((prev) => resetGame(prev));
      setTimeout(() => {
        setState((prev) => jumpAction(prev ?? createInitialState()));
      }, 100);
    }
  }, [state.phase]);

  const onReset = useCallback(() => {
    setState((prev) => resetGame(prev));
  }, []);

  return { state, canvasWidth, canvasHeight, onJump, onStart, onReset };
}
