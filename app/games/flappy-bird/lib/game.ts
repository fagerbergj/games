import {
  FlappyBirdState,
  BirdState,
  PipeData,
} from "./types";

// --- Constants (defaults) ---
export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 600;
export const BIRD_SIZE = 30;
export const GRAVITY = 0.5;
export const JUMP_STRENGTH = -8;
export const PIPE_SPEED = 2;
export const PIPE_GAP = 140;
export const PIPE_WIDTH = 52;
export const MIN_GAP_Y = 80;
export const MAX_GAP_Y = CANVAS_HEIGHT - 80;
export const GROUND_HEIGHT = 60;

// --- Utility functions ---

/** Creates the initial game state (ready phase). */
export function createInitialState(): FlappyBirdState {
  return {
    phase: "ready",
    bird: { y: CANVAS_HEIGHT / 2 - BIRD_SIZE / 2, velocity: 0 },
    pipes: [],
    score: 0,
    highScore: 0,
    frameCount: 0,
  };
}

/** Returns the next pipe id (monotonically increasing). */
export function getNextPipeId(pipes: PipeData[]): number {
  if (pipes.length === 0) return 1;
  return Math.max(...pipes.map((p) => p.id)) + 1;
}

/** Generates a new pipe at the right edge with a random gap position. */
export function generatePipe(lastPipeX: number): PipeData {
  const x = lastPipeX + PIPE_WIDTH + CANVAS_WIDTH / 2 + Math.random() * 80;
  const gapY = MIN_GAP_Y + Math.random() * (MAX_GAP_Y - MIN_GAP_Y);
  return { id: getNextPipeId([]), x, gapY };
}

/** Generates the first pipe. */
export function generateFirstPipe(): PipeData {
  return generatePipe(CANVAS_WIDTH + 100);
}

// --- Collision helpers ---

export interface CollisionInfo {
  hitPipe: boolean;
  hitGround: boolean;
}

/** Checks whether the bird collides with pipes or boundaries. */
export function checkCollision(
  birdY: number,
  birdX: number,
  pipes: PipeData[],
): CollisionInfo {
  // Ground collision
  const hitGround = birdY + BIRD_SIZE >= CANVAS_HEIGHT - GROUND_HEIGHT;

  // Ceiling collision
  if (birdY <= 0) return { hitPipe: false, hitGround: true };

  if (hitGround) return { hitPipe: false, hitGround: true };

  // Pipe collision – AABB vs two rectangles (top pipe, bottom pipe)
  let hitPipe = false;
  for (const pipe of pipes) {
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + PIPE_WIDTH;

    // Horizontal overlap
    if (birdX + BIRD_SIZE > pipeLeft && birdX < pipeRight) {
      // Vertical gap region
      const gapTop = pipe.gapY - PIPE_GAP / 2;
      const gapBottom = pipe.gapY + PIPE_GAP / 2;
      // Collision when bird touches top or bottom pipe (outside the gap)
      if (birdY < gapTop || birdY + BIRD_SIZE > gapBottom) {
        hitPipe = true;
      }
    }
  }

  return { hitPipe, hitGround: false };
}

/** Returns whether the bird has passed a given pipe (pipe left edge crossed). */
export function hasPassedBird(pipeX: number, birdX: number): boolean {
  return pipeX + PIPE_WIDTH < birdX;
}

// --- Game loop step (pure logic) ---

/**
 * Advances one frame of the simulation.
 * Returns a new immutable state object.
 */
export function step(state: FlappyBirdState): FlappyBirdState {
  if (state.phase === "ready") return state;
  if (state.phase === "gameover") return state;

  const { bird, pipes } = state;
  const newBird: BirdState = {
    y: bird.y,
    velocity: bird.velocity + GRAVITY,
  };
  const newPipes: PipeData[] = [];
  let score = state.score;
  let hitPipe = false;
  let hitGround = false;

  // Update pipes
  for (const pipe of pipes) {
    const movedX = pipe.x - PIPE_SPEED;
    if (movedX + PIPE_WIDTH > 0) {
      newPipes.push({ ...pipe, x: movedX });
    }
    if (!hitPipe && !hitGround && hasPassedBird(pipe.x, CANVAS_WIDTH / 3)) {
      score += 1;
    }
  }

  // Check collisions
  const collision = checkCollision(newBird.y, CANVAS_WIDTH / 3 - BIRD_SIZE / 2, pipes);
  hitPipe = collision.hitPipe;
  hitGround = collision.hitGround;

  if (hitPipe || hitGround) {
    const highScore = Math.max(state.highScore, score);
    return {
      ...state,
      bird: newBird,
      pipes: newPipes,
      phase: "gameover",
      score,
      highScore,
    };
  }

  // Spawn a new pipe if needed
  const lastPipe = newPipes[newPipes.length - 1];
  const spawnThreshold = CANVAS_WIDTH - 200;
  if (!lastPipe || lastPipe.x < spawnThreshold) {
    const newPipe = generateFirstPipe();
    newPipes.push(newPipe);
  }

  return {
    ...state,
    bird: newBird,
    pipes: newPipes,
    score,
    phase: "playing",
    frameCount: state.frameCount + 1,
  };
}

/** Jumps the bird (reset velocity). */
export function jump(state: FlappyBirdState): FlappyBirdState {
  if (state.phase === "gameover") return state;
  if (state.phase === "ready") {
    const newState = { ...state, phase: "playing" as const } as FlappyBirdState;
    return step(newState);
  }
  return { ...state, bird: { y: state.bird.y, velocity: JUMP_STRENGTH } };
}

/** Resets to ready state. */
export function resetGame(state: FlappyBirdState): FlappyBirdState {
  const initial = createInitialState();
  return { ...initial, highScore: state.highScore };
}
