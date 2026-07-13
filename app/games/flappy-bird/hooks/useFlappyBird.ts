import { useState, useCallback, useEffect } from "react";
import { useInterval } from "./useInterval";

import type { FlappyState } from "../lib/flappyBird";
import {
  GRAVITY,
  PIPE_SPEED,
  PIPE_GAP,
  PIPE_SPAWN_INTERVAL,
  GAME_WIDTH,
  BIRD_SIZE,
} from "../lib/constants";
import {
  createInitialState,
  flapBird as flapBirdLogic,
  applyGravity,
  movePipe,
  spawnPipe,
  checkCollision,
  updateScore,
  isPipeOffScreen,
} from "../lib/flappyBird";

function loadHighScore(): number {
  try {
    const stored = localStorage.getItem("flappy-bird-high-score");
    if (stored) {
      return parseInt(stored, 10) || 0;
    }
  } catch {
    // ignore (e.g., during SSR)
  }
  return 0;
}

export function useFlappyBird() {
  const initialHighScore = loadHighScore();

  const [state, setState] = useState<FlappyState>(() =>
    createInitialState(initialHighScore),
  );

  const [frameCount, setFrameCount] = useState(0);

  // Save high score to localStorage when it changes in state
  useEffect(() => {
    if (state.highScore > 0) {
      try {
        localStorage.setItem("flappy-bird-high-score", state.highScore.toString());
      } catch {
        // ignore
      }
    }
  }, [state.highScore]);

  const startGame = useCallback(() => {
    setState((prev) => ({
      ...createInitialState(prev.highScore),
      phase: "playing",
    }));
    setFrameCount(0);
  }, []);

  const resetGame = useCallback(() => {
    setState((prev) => createInitialState(prev.highScore));
    setFrameCount(0);
  }, []);

  const flap = useCallback(() => {
    setState((prev) => {
      if (prev.phase === "idle") {
        return { ...prev, phase: "playing" };
      }
      if (prev.phase !== "playing") {
        return prev;
      }
      return { ...prev, bird: flapBirdLogic(prev.bird) };
    });
  }, []);

  // Game loop - runs every ~16ms (60fps) when playing
  useInterval(() => {
    if (state.phase !== "playing") return;

    setFrameCount((f) => f + 1);

    setState((prev) => {
      if (prev.phase !== "playing") return prev;

      const currentFrame = frameCount + 1;

      // Apply gravity to bird
      const newBird = applyGravity(prev.bird, GRAVITY);

      // Spawn new pipes at intervals
      let newPipes = [...prev.pipes];
      if (currentFrame % Math.round(PIPE_SPAWN_INTERVAL / 16) === 0) {
        const lastPipeX =
          newPipes.length > 0
            ? newPipes[newPipes.length - 1].x
            : GAME_WIDTH + PIPE_GAP;
        newPipes.push(spawnPipe(lastPipeX));
      }

      // Move pipes and check for passing / scoring
      const birdXPipeCheck = GAME_WIDTH / 4 + BIRD_SIZE;
      const scoredPipeIds = new Set<number>();
      newPipes = newPipes
        .map((pipe) => {
          if (!scoredPipeIds.has(pipe.id)) {
            const didScore = updateScore(pipe, birdXPipeCheck);
            if (didScore) {
              scoredPipeIds.add(pipe.id);
            }
          }
          return movePipe(pipe, PIPE_SPEED);
        })
        .filter(isPipeOffScreen);

      // Check collisions
      const collision = checkCollision(newBird, newPipes);
      if (collision) {
        return {
          ...prev,
          bird: newBird,
          pipes: newPipes,
          phase: "gameover",
        };
      }

      // Calculate new score
      const currentScore = prev.score + (scoredPipeIds.size > 0 ? scoredPipeIds.size : 0);
      const newHighScore = Math.max(currentScore, prev.highScore);

      return {
        ...prev,
        bird: newBird,
        pipes: newPipes,
        score: currentScore,
        highScore: newHighScore,
        frameCount: currentFrame,
      };
    });
  }, state.phase === "playing" ? 16 : undefined);

  return {
    state,
    startGame,
    resetGame,
    flap,
    setFrameCount,
  };
}
