"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  createInitialState,
  flap,
  updateState,
} from "./lib/gameLogic";
import type { FlappyBirdState } from "./lib/types";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BIRD_X = 50;

export default function FlappyBirdPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<FlappyBirdState>(
    createInitialState(CANVAS_WIDTH, CANVAS_HEIGHT)
  );
  const lastPipeSpawnRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, state: FlappyBirdState) => {
      // Sky
      ctx.fillStyle = "#4ec0ca";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Ground
      ctx.fillStyle = "#ded895";
      ctx.fillRect(
        0,
        state.groundY,
        CANVAS_WIDTH,
        CANVAS_HEIGHT - state.groundY
      );
      ctx.strokeStyle = "#73bf2e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, state.groundY);
      ctx.lineTo(CANVAS_WIDTH, state.groundY);
      ctx.stroke();

      // Pipes
      ctx.fillStyle = "#73bf2e";
      for (const pipe of state.pipes) {
        // Top pipe
        ctx.fillRect(pipe.x, 0, 60, pipe.gapTop);
        ctx.strokeStyle = "#558b2f";
        ctx.lineWidth = 2;
        ctx.strokeRect(pipe.x, 0, 60, pipe.gapTop);

        // Bottom pipe
        const bottomY = pipe.gapTop + 150;
        ctx.fillRect(pipe.x, bottomY, 60, CANVAS_HEIGHT - bottomY);
        ctx.strokeRect(pipe.x, bottomY, 60, CANVAS_HEIGHT - bottomY);
      }

      // Bird (simple circle)
      ctx.fillStyle = "#f4e238";
      ctx.beginPath();
      const birdCenterX = BIRD_X + 15;
      const birdCenterY = state.bird.y + 15;
      ctx.arc(birdCenterX, birdCenterY, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e8c319";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Bird eye
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(birdCenterX + 5, birdCenterY - 5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(birdCenterX + 6, birdCenterY - 5, 2, 0, Math.PI * 2);
      ctx.fill();

      // Score
      ctx.fillStyle = "white";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      ctx.font = "bold 48px Arial";
      ctx.textAlign = "center";
      ctx.strokeText(state.score.toString(), CANVAS_WIDTH / 2, 60);
      ctx.fillText(state.score.toString(), CANVAS_WIDTH / 2, 60);

      // Game over overlay
      if (state.gameState === "gameover") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = "white";
        ctx.font = "bold 36px Arial";
        ctx.fillText("Game Over", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

        ctx.font = "24px Arial";
        ctx.fillText(
          `Score: ${state.score}`,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 10
        );
        ctx.fillText(
          `Best: ${Math.max(state.score, state.highScore)}`,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 50
        );

        ctx.font = "18px Arial";
        ctx.fillStyle = "#f4e238";
        ctx.fillText(
          "Click or press Space to restart",
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 100
        );
      } else if (state.gameState === "start") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = "white";
        ctx.font = "bold 32px Arial";
        ctx.fillText("Flappy Bird", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

        ctx.font = "18px Arial";
        ctx.fillStyle = "#f4e238";
        ctx.fillText(
          "Click or press Space to start",
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 + 20
        );
      }
    },
    []
  );

  // Draw initial state on mount
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      draw(ctx, gameStateRef.current);
    }
  }, [draw]);

  const startGameLoop = useCallback(() => {
    let running = true;

    const loop = (timestamp: number) => {
      if (!running) return;

      const currentState = gameStateRef.current;
      if (currentState.gameState !== "playing") return;

      const pipeCountBefore = currentState.pipes.length;

      const { state: newState } = updateState(
        currentState,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        timestamp,
        lastPipeSpawnRef.current
      );

      // Only advance spawn timer when a new pipe is actually spawned
      if (newState.pipes.length > pipeCountBefore) {
        lastPipeSpawnRef.current = timestamp;
      }

      if (newState.gameState === "playing") {
        gameStateRef.current = newState;
        setDisplayScore(newState.score);
      } else {
        // Game over — stop loop and draw final state
        gameStateRef.current = newState;
        setHighScore(
          Math.max(currentState.highScore, currentState.score)
        );
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) draw(ctx, newState);
        return;
      }

      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx, newState);

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  const handleAction = useCallback(() => {
    const state = gameStateRef.current;

    if (state.gameState === "gameover" || state.gameState === "start") {
      // Reset game
      const freshState = createInitialState(CANVAS_WIDTH, CANVAS_HEIGHT);
      gameStateRef.current = freshState;
      lastPipeSpawnRef.current = 0;
      setDisplayScore(0);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      // Redraw initial state and start game
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        draw(ctx, gameStateRef.current);
      }

      // Transition to playing on next action
      gameStateRef.current = flap(gameStateRef.current);
      if (ctx) {
        draw(ctx, gameStateRef.current);
      }

      startGameLoop();
      return;
    }

    const newState = flap(state);
    gameStateRef.current = newState;

    if (newState.gameState === "playing" && !animFrameRef.current) {
      startGameLoop();
    }

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      draw(ctx, newState);
    }
  }, [draw, startGameLoop]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleAction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [handleAction]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-sky-300 to-sky-500">
      <h1 className="text-4xl font-bold text-white mb-6 drop-shadow-lg">Flappy Bird</h1>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleAction}
        className="border-4 border-slate-800 rounded-xl shadow-2xl cursor-pointer max-w-full"
        style={{ touchAction: "none" }}
      />

      <div className="mt-6 text-center space-y-2">
        <p className="text-white font-semibold drop-shadow-md">
          Score: {displayScore} | Best: {Math.max(displayScore, highScore)}
        </p>
        <p className="text-sky-900/70 text-sm">
          Click or press Space/ArrowUp to flap
        </p>
      </div>
    </div>
  );
}
