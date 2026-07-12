"use client";

import { useEffect, useRef, useCallback } from "react";
import { FlappyBirdState } from "../lib/types";
import { DEFAULT_PIPE_WIDTH, DEFAULT_BIRD_SIZE, DEFAULT_GROUND_HEIGHT, DEFAULT_PIPE_GAP_HEIGHT } from "../lib/game-logic";

interface GameCanvasProps {
  state: FlappyBirdState | null;
  canvasWidth: number;
  canvasHeight: number;
  onFlap?: () => void;
}

export default function GameCanvas({ state, canvasWidth, canvasHeight, onFlap }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawBird = useCallback((ctx: CanvasRenderingContext2D, birdX: number, birdY: number, velocity: number) => {
    const size = DEFAULT_BIRD_SIZE;
    const halfSize = size / 2;

    // Bird body (yellow circle)
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(birdX, birdY, halfSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#B8860B";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bird eye (white with black pupil)
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(birdX + halfSize * 0.3, birdY - halfSize * 0.2, halfSize * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(birdX + halfSize * 0.4, birdY - halfSize * 0.2, halfSize * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Bird beak (orange triangle)
    ctx.fillStyle = "#FF8C00";
    ctx.beginPath();
    ctx.moveTo(birdX + halfSize * 0.8, birdY);
    ctx.lineTo(birdX + halfSize * 1.6, birdY + halfSize * 0.2);
    ctx.lineTo(birdX + halfSize * 0.8, birdY + halfSize * 0.4);
    ctx.closePath();
    ctx.fill();

    // Bird wing (flaps based on velocity)
    const flapAngle = Math.max(-0.5, Math.min(0.5, velocity * 0.05));
    ctx.fillStyle = "#FFC107";
    ctx.save();
    ctx.translate(birdX - halfSize * 0.2, birdY);
    ctx.rotate(flapAngle);
    ctx.beginPath();
    ctx.ellipse(0, 0, halfSize * 0.6, halfSize * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#B8860B";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }, []);

  const drawPipe = useCallback((ctx: CanvasRenderingContext2D, pipeX: number, gapY: number, gapHeight: number) => {
    const pipeWidth = DEFAULT_PIPE_WIDTH;
    const bodyHeight = canvasHeight - DEFAULT_GROUND_HEIGHT;
    const capHeight = 20;
    const capOverhang = 4;

    // Top pipe body
    const topPipeBottom = gapY - gapHeight / 2;
    const gradient1 = ctx.createLinearGradient(pipeX, 0, pipeX + pipeWidth, 0);
    gradient1.addColorStop(0, "#2E7D32");
    gradient1.addColorStop(0.5, "#4CAF50");
    gradient1.addColorStop(1, "#2E7D32");
    ctx.fillStyle = gradient1;
    ctx.fillRect(pipeX, 0, pipeWidth, topPipeBottom);

    // Top pipe cap
    ctx.fillStyle = "#388E3C";
    ctx.fillRect(pipeX - capOverhang, topPipeBottom - capHeight, pipeWidth + capOverhang * 2, capHeight);
    ctx.strokeStyle = "#1B5E20";
    ctx.lineWidth = 2;
    ctx.strokeRect(pipeX - capOverhang, topPipeBottom - capHeight, pipeWidth + capOverhang * 2, capHeight);

    // Bottom pipe body
    const bottomPipeTop = gapY + gapHeight / 2;
    ctx.fillStyle = gradient1;
    ctx.fillRect(pipeX, bottomPipeTop, pipeWidth, bodyHeight - bottomPipeTop);

    // Bottom pipe cap
    ctx.fillStyle = "#388E3C";
    ctx.fillRect(pipeX - capOverhang, bottomPipeTop, pipeWidth + capOverhang * 2, capHeight);
    ctx.strokeStyle = "#1B5E20";
    ctx.strokeRect(pipeX - capOverhang, bottomPipeTop, pipeWidth + capOverhang * 2, capHeight);

    // Pipe borders
    ctx.strokeStyle = "#1B5E20";
    ctx.lineWidth = 2;
    ctx.strokeRect(pipeX, 0, pipeWidth, topPipeBottom);
    ctx.strokeRect(pipeX, bottomPipeTop, pipeWidth, bodyHeight - bottomPipeTop);
  }, [canvasHeight]);

  const drawGround = useCallback((ctx: CanvasRenderingContext2D, groundOffset: number) => {
    const groundY = canvasHeight - DEFAULT_GROUND_HEIGHT;

    // Ground fill
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(0, groundY, canvasWidth, DEFAULT_GROUND_HEIGHT);

    // Grass top strip
    const grassGradient = ctx.createLinearGradient(0, groundY, 0, groundY + 15);
    grassGradient.addColorStop(0, "#4CAF50");
    grassGradient.addColorStop(1, "#388E3C");
    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, groundY, canvasWidth, 15);

    // Ground texture lines (scrolling)
    ctx.strokeStyle = "#6D360A";
    ctx.lineWidth = 1;
    for (let x = groundOffset; x < canvasWidth + 24; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 20);
      ctx.lineTo(x + 12, groundY + 35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 12, groundY + 20);
      ctx.lineTo(x, groundY + 35);
      ctx.stroke();
    }
  }, [canvasWidth, canvasHeight]);

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    // Sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight - DEFAULT_GROUND_HEIGHT);
    skyGradient.addColorStop(0, "#87CEEB");
    skyGradient.addColorStop(0.6, "#B3E5FC");
    skyGradient.addColorStop(1, "#E1F5FE");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight - DEFAULT_GROUND_HEIGHT);

    // Clouds (static decorative)
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    const drawCloud = (cx: number, cy: number, scale: number) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 20 * scale, 0, Math.PI * 2);
      ctx.arc(cx + 25 * scale, cy - 10 * scale, 18 * scale, 0, Math.PI * 2);
      ctx.arc(cx + 50 * scale, cy, 20 * scale, 0, Math.PI * 2);
      ctx.arc(cx + 25 * scale, cy + 5 * scale, 15 * scale, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCloud(60, 80, 1);
    drawCloud(220, 120, 0.7);
    drawCloud(340, 60, 0.9);
    drawCloud(150, 200, 0.6);
  }, [canvasWidth, canvasHeight]);

  const drawScore = useCallback((ctx: CanvasRenderingContext2D, score: number) => {
    ctx.save();
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 4;
    ctx.strokeText(score.toString(), canvasWidth / 2, 60);
    ctx.fillText(score.toString(), canvasWidth / 2, 60);
    ctx.restore();
  }, [canvasWidth]);

  // Main render effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    drawBackground(ctx);

    // Draw pipes
    for (const pipe of state.pipes) {
      drawPipe(ctx, pipe.x, pipe.gapY, pipe.gapHeight || DEFAULT_PIPE_GAP_HEIGHT);
    }

    // Draw bird
    drawBird(ctx, state.bird.x, state.bird.y, state.bird.velocity);

    // Draw ground
    drawGround(ctx, state.groundX);

    // Draw score (always visible during gameplay)
    if (state.phase === "playing") {
      drawScore(ctx, state.score);
    }

    // Draw game over overlay
    if (state.phase === "gameover") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#FF4444";
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 3;
      const goText = "GAME OVER";
      ctx.strokeText(goText, canvasWidth / 2, canvasHeight / 2 - 50);
      ctx.fillText(goText, canvasWidth / 2, canvasHeight / 2 - 50);

      ctx.font = "bold 24px sans-serif";
      ctx.fillStyle = "white";
      ctx.strokeText(`Score: ${state.score}`, canvasWidth / 2, canvasHeight / 2 + 10);
      ctx.fillText(`Score: ${state.score}`, canvasWidth / 2, canvasHeight / 2 + 10);

      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#FFD700";
      ctx.strokeText(`Best: ${state.highScore}`, canvasWidth / 2, canvasHeight / 2 + 45);
      ctx.fillText(`Best: ${state.highScore}`, canvasWidth / 2, canvasHeight / 2 + 45);

      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#aaa";
      ctx.fillText("Click to play again", canvasWidth / 2, canvasHeight / 2 + 80);
    }

    // Draw setup screen text
    if (state.phase === "setup") {
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "white";
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 3;
      const titleText = "Flappy Bird";
      ctx.strokeText(titleText, canvasWidth / 2, canvasHeight / 2 - 30);
      ctx.fillText(titleText, canvasWidth / 2, canvasHeight / 2 - 30);

      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#aaa";
      ctx.fillText("Click to start", canvasWidth / 2, canvasHeight / 2 + 20);
    }
  }, [state, drawBackground, drawPipe, drawBird, drawGround, drawScore, canvasWidth, canvasHeight]);

  // Handle click/tap for flap
  const handleClick = useCallback(() => {
    if (state?.phase === "gameover" || state?.phase === "setup") {
      onFlap?.();
    } else {
      onFlap?.();
    }
  }, [state, onFlap]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      onClick={handleClick}
      className="rounded-2xl shadow-2xl border-4 border-zinc-800 cursor-pointer max-w-full"
      style={{ touchAction: "none" }}
    />
  );
}
