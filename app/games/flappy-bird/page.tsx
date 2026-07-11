"use client";

import { useEffect, useRef } from "react";
import {
  createInitialState,
  applyFlap,
  tick,
  resetGame,
  DEFAULT_OPTIONS,
  type FlappyBirdOptions,
} from "@/app/games/flappy-bird/lib/flappy-bird-logic";

const COLORS = {
  sky: "#70c5ce",
  ground: "#ded895",
  groundStripe: "#c4b663",
  pipe: "#73bf2e",
  pipeBorder: "#558f22",
  bird: "#f8e056",
  birdBorder: "#d4a71e",
  text: "#ffffff",
} as const;

const OPTIONS: FlappyBirdOptions = DEFAULT_OPTIONS;

export default function FlappyBirdPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let state = createInitialState(OPTIONS);
    let rafId: number | null = null;
    let lastTime = 0;
    let accumulator = 0;
    const TICK_RATE = 1000 / 60; // 60 fps for logic

    function draw() {
      if (!ctx) return;

      ctx.fillStyle = COLORS.sky;
      ctx.fillRect(0, 0, OPTIONS.canvasWidth, OPTIONS.canvasHeight);

      // Ground
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(0, state.groundY, OPTIONS.canvasWidth, OPTIONS.canvasHeight - state.groundY);
      ctx.fillStyle = COLORS.groundStripe;
      ctx.fillRect(0, state.groundY, OPTIONS.canvasWidth, 4);

      // Pipes
      for (const pipe of state.pipes) {
        ctx.fillStyle = COLORS.pipe;
        ctx.strokeStyle = COLORS.pipeBorder;
        ctx.lineWidth = 2;

        // Top pipe
        ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
        ctx.strokeRect(pipe.x, 0, pipe.width, pipe.topHeight);
        // Bottom pipe
        ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, OPTIONS.canvasHeight - pipe.bottomY);
        ctx.strokeRect(pipe.x, pipe.bottomY, pipe.width, OPTIONS.canvasHeight - pipe.bottomY);
      }

      // Bird (simple rounded rectangle)
      const { x: bx, y: by, width: bw, height: bh } = state.bird;
      ctx.fillStyle = COLORS.bird;
      ctx.strokeStyle = COLORS.birdBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 4);
      ctx.fill();
      ctx.stroke();

      // Score (when playing)
      if (state.phase === "playing") {
        ctx.fillStyle = COLORS.text;
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(state.score), OPTIONS.canvasWidth / 2, 50);
      }

      // Game over screen
      if (state.phase === "gameover") {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, OPTIONS.canvasWidth, OPTIONS.canvasHeight);

        ctx.fillStyle = COLORS.text;
        ctx.font = "bold 36px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Game Over", OPTIONS.canvasWidth / 2, OPTIONS.canvasHeight / 2 - 40);

        ctx.font = "24px sans-serif";
        ctx.fillText(`Score: ${state.score}`, OPTIONS.canvasWidth / 2, OPTIONS.canvasHeight / 2 + 10);
        if (state.highScore > 0) {
          ctx.fillText(`Best: ${state.highScore}`, OPTIONS.canvasWidth / 2, OPTIONS.canvasHeight / 2 + 45);
        }

        ctx.font = "18px sans-serif";
        ctx.fillStyle = "#ddd";
        ctx.fillText("Click or Space to restart", OPTIONS.canvasWidth / 2, OPTIONS.canvasHeight / 2 + 90);
      }

      // Idle screen
      if (state.phase === "idle") {
        ctx.fillStyle = COLORS.text;
        ctx.font = "bold 36px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Flappy Bird", OPTIONS.canvasWidth / 2, OPTIONS.canvasHeight / 2 - 40);

        ctx.font = "18px sans-serif";
        ctx.fillStyle = "#ddd";
        ctx.fillText("Click or press Space to start", OPTIONS.canvasWidth / 2, OPTIONS.canvasHeight / 2 + 10);
      }
    }

    function gameLoop(timestamp: number) {
      if (lastTime === 0) lastTime = timestamp;
      const delta = timestamp - lastTime;
      lastTime = timestamp;
      accumulator += delta;

      while (accumulator >= TICK_RATE) {
        state = tick(state, OPTIONS);
        accumulator -= TICK_RATE;
      }

      draw();
      rafId = requestAnimationFrame(gameLoop);
    }

    function flapOrRestart() {
      if (state.phase === "gameover") {
        state = resetGame(state, OPTIONS);
      } else if (state.phase === "idle") {
        state = applyFlap(state, OPTIONS);
      } else {
        // playing — just flap
        state = applyFlap(state, OPTIONS);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        flapOrRestart();
      }
    }

    document.addEventListener("keydown", onKey);
    canvas.addEventListener("click", flapOrRestart);
    rafId = requestAnimationFrame(gameLoop);

    return () => {
      document.removeEventListener("keydown", onKey);
      canvas.removeEventListener("click", flapOrRestart);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={OPTIONS.canvasWidth}
      height={OPTIONS.canvasHeight}
      className="block mx-auto rounded-xl border-4 border-zinc-700 max-w-full"
    />
  );
}
