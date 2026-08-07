import { PIPE_GAP, PIPE_SPEED, BIRD_SIZE, GAME_WIDTH, GAME_HEIGHT } from "./constants";

// --- Types ---

export interface Bird {
  y: number;
  velocity: number;
}

export interface Pipe {
  id: number;
  x: number;
  topHeight: number;
  passed: boolean;
}

export type GamePhase = "idle" | "playing" | "gameover";

export interface FlappyState {
  phase: GamePhase;
  bird: Bird;
  pipes: Pipe[];
  score: number;
  highScore: number;
  lastPipeSpawn: number;
}

// --- Pure game logic functions (testable) ---

export function createInitialState(highScore: number): FlappyState {
  return {
    phase: "idle",
    bird: { y: GAME_HEIGHT / 2 - BIRD_SIZE / 2, velocity: 0 },
    pipes: [],
    score: 0,
    highScore,
    lastPipeSpawn: 0,
  };
}

export function flapBird(bird: Bird): Bird {
  return { ...bird, velocity: -10 };
}

export function applyGravity(bird: Bird, gravity = 0.6): Bird {
  const newVelocity = bird.velocity + gravity;
  const newY = Math.min(bird.y + newVelocity, GAME_HEIGHT);
  return { y: newY, velocity: newVelocity };
}

export function movePipe(pipe: Pipe, speed = PIPE_SPEED): Pipe {
  return { ...pipe, x: pipe.x - speed };
}

export function spawnPipe(lastSpawnX: number, seed?: number): Pipe {
  const minTop = 80;
  const maxTop = GAME_HEIGHT - PIPE_GAP - 80;
  // Simple seeded random using mulberry32 if seed provided
  let topHeight: number;
  if (seed !== undefined) {
    const s = (seed * 9301 + 49297) % 233280;
    const rand = s / 233280;
    topHeight = minTop + Math.floor(rand * (maxTop - minTop));
  } else {
    topHeight = minTop + Math.floor(Math.random() * (maxTop - minTop));
  }
  return {
    id: Date.now() + Math.random(),
    x: lastSpawnX,
    topHeight,
    passed: false,
  };
}

export function checkCollision(
  bird: Bird,
  pipes: Pipe[],
): "bird-ground" | "bird-ceiling" | "bird-pipe" | null {
  const birdTop = bird.y;
  const birdBottom = bird.y + BIRD_SIZE;
  const birdLeft = GAME_WIDTH / 4; // bird X position (fixed)
  const birdRight = birdLeft + BIRD_SIZE;

  // Ground/ceiling collision
  if (birdBottom >= GAME_HEIGHT - 20) {
    return "bird-ground";
  }
  if (birdTop <= 0) {
    return "bird-ceiling";
  }

  // Pipe collision
  const pipeLeft = birdLeft; // Since bird is at fixed X, pipes crossing that X are relevant
  const pipeRight = birdRight;

  for (const pipe of pipes) {
    const pipeBoxLeft = pipe.x;
    const pipeBoxRight = pipe.x + PIPE_GAP / 2; // pipe visual width approximated

    if (pipeBoxRight > pipeLeft && pipeBoxLeft < pipeRight) {
      const bottomOfTopPipe = pipe.topHeight;
      const topOfBottomPipe = pipe.topHeight + PIPE_GAP;

      if (birdTop < bottomOfTopPipe || birdBottom > topOfBottomPipe) {
        return "bird-pipe";
      }
    }
  }

  return null;
}

export function updateScore(pipe: Pipe, birdX: number): boolean {
  // Mark pipe as passed when bird passes it
  if (!pipe.passed && pipe.x + PIPE_GAP / 2 < birdX) {
    return true;
  }
  return false;
}

export function isPipeOffScreen(pipe: Pipe): boolean {
  return pipe.x + PIPE_GAP / 2 < -50;
}
