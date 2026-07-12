import { Bird, Pipe, FlappyBirdState } from "./types";

// Default constants for the game
export const DEFAULT_GRAVITY = 0.5;
export const DEFAULT_FLAP_STRENGTH = -8;
export const DEFAULT_PIPE_SPEED = 2;
export const DEFAULT_PIPE_GAP_HEIGHT = 140;
export const DEFAULT_PIPE_WIDTH = 50;
export const DEFAULT_BIRD_SIZE = 30;
export const DEFAULT_GROUND_HEIGHT = 60;

/**
 * Creates a new FlappyBirdState with the bird at its starting position.
 */
export function createInitialState(
  canvasWidth: number,
  canvasHeight: number,
  highScore: number = 0
): FlappyBirdState {
  const birdStartY = canvasHeight / 2;
  return {
    phase: "setup",
    bird: { x: canvasWidth * 0.25, y: birdStartY, velocity: 0 },
    pipes: [],
    score: 0,
    highScore,
    groundX: 0,
  };
}

/**
 * Applies gravity to the bird's velocity and returns updated bird state.
 */
export function applyGravity(
  bird: Bird,
  gravity: number = DEFAULT_GRAVITY
): Bird {
  return {
    ...bird,
    velocity: bird.velocity + gravity,
  };
}

/**
 * Makes the bird flap (set upward velocity).
 */
export function flap(bird: Bird, flapStrength: number = DEFAULT_FLAP_STRENGTH): Bird {
  return {
    ...bird,
    velocity: flapStrength,
  };
}

/**
 * Generates a new pipe at the given x position with a random gap.
 */
export function createPipe(
  x: number,
  canvasHeight: number,
  groundHeight: number = DEFAULT_GROUND_HEIGHT,
  gapHeight: number = DEFAULT_PIPE_GAP_HEIGHT,
  minGapY: number = groundHeight + 50,
  maxGapY: number = canvasHeight - groundHeight - gapHeight - 50
): Pipe {
  const gapY = Math.max(minGapY, Math.min(maxGapY, Math.random() * (maxGapY - minGapY) + minGapY));
  return {
    id: `pipe-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    x,
    gapY,
    gapHeight,
    scored: false,
  };
}

/**
 * Moves a pipe to the left by the given speed.
 */
export function movePipe(pipe: Pipe, pipeSpeed: number = DEFAULT_PIPE_SPEED): Pipe {
  return {
    ...pipe,
    x: pipe.x - pipeSpeed,
  };
}

/**
 * Checks if the bird collides with any pipe.
 */
export function checkPipeCollision(
  bird: Bird,
  pipes: Pipe[],
  birdSize: number = DEFAULT_BIRD_SIZE,
  pipeWidth: number = DEFAULT_PIPE_WIDTH
): boolean {
  const birdLeft = bird.x - birdSize / 2;
  const birdRight = bird.x + birdSize / 2;
  const birdTop = bird.y - birdSize / 2;
  const birdBottom = bird.y + birdSize / 2;

  for (const pipe of pipes) {
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + pipeWidth;

    // Check if bird's x-range overlaps with pipe's x-range
    if (birdRight > pipeLeft && birdLeft < pipeRight) {
      // Check if bird is above gap or below gap (i.e., collides with pipe body)
      const gapTop = pipe.gapY - pipe.gapHeight / 2;
      const gapBottom = pipe.gapY + pipe.gapHeight / 2;

      if (birdTop < gapTop || birdBottom > gapBottom) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if the bird collides with the ground or ceiling.
 */
export function checkBoundaryCollision(
  bird: Bird,
  canvasHeight: number,
  groundHeight: number = DEFAULT_GROUND_HEIGHT,
  birdSize: number = DEFAULT_BIRD_SIZE
): boolean {
  const birdBottom = bird.y + birdSize / 2;
  const birdTop = bird.y - birdSize / 2;

  return birdBottom >= canvasHeight - groundHeight || birdTop <= 0;
}

/**
 * Generates the next pipe if needed based on distance between pipes.
 */
export function generateNextPipe(
  pipes: Pipe[],
  canvasWidth: number,
  canvasHeight: number,
  nextPipeDistance: number = 220
): Pipe | null {
  const lastPipe = pipes[pipes.length - 1];
  if (!lastPipe || lastPipe.x < canvasWidth - nextPipeDistance) {
    return createPipe(canvasWidth, canvasHeight);
  }
  return null;
}

/**
 * Removes off-screen pipes.
 */
export function cleanupPipes(pipes: Pipe[]): Pipe[] {
  return pipes.filter((pipe) => pipe.x + DEFAULT_PIPE_WIDTH > -10);
}

/**
 * Updates the ground scroll position for animation.
 */
export function updateGroundX(groundX: number, pipeSpeed: number = DEFAULT_PIPE_SPEED): number {
  return (groundX - pipeSpeed) % 24;
}

/**
 * Advances a single frame of game logic during gameplay.
 * Returns the updated state.
 */
export function advanceGameFrame(
  state: FlappyBirdState,
  canvasWidth: number,
  canvasHeight: number,
  gravity: number = DEFAULT_GRAVITY,
  pipeSpeed: number = DEFAULT_PIPE_SPEED,
  birdSize: number = DEFAULT_BIRD_SIZE,
  pipeWidth: number = DEFAULT_PIPE_WIDTH,
  groundHeight: number = DEFAULT_GROUND_HEIGHT,
  nextPipeDistance: number = 220
): FlappyBirdState {
  const newBird = applyGravity(state.bird, gravity);
  const newPipes = state.pipes.map((pipe) => movePipe(pipe, pipeSpeed));

  // Generate the next pipe if needed
  const nextPipe = generateNextPipe(newPipes, canvasWidth, canvasHeight, nextPipeDistance);
  if (nextPipe) {
    newPipes.push(nextPipe);
  }

  // Remove off-screen pipes
  const activePipes = cleanupPipes(newPipes);

  // Check collisions
  const pipeCollision = checkPipeCollision(newBird, activePipes, birdSize, pipeWidth);
  const boundaryCollision = checkBoundaryCollision(newBird, canvasHeight, groundHeight, birdSize);

  if (pipeCollision || boundaryCollision) {
    return {
      ...state,
      phase: "gameover",
      bird: newBird,
      pipes: activePipes,
    };
  }

  // Update score: count how many pipes the bird has passed
  let newScore = state.score;
  const updatedPipes = activePipes.map((pipe) => {
    if (!pipe.scored && pipe.x + pipeWidth < newBird.x) {
      newScore += 1;
      return { ...pipe, scored: true };
    }
    return pipe;
  });

  // Update high score if needed
  const newHighScore = Math.max(state.highScore, newScore);

  const newGroundX = updateGroundX(state.groundX, pipeSpeed);

  return {
    ...state,
    bird: newBird,
    pipes: updatedPipes,
    score: newScore,
    highScore: newHighScore,
    groundX: newGroundX,
  };
}

/**
 * Resets the game state to its initial configuration.
 */
export function resetGame(state: FlappyBirdState, canvasWidth: number, canvasHeight: number): FlappyBirdState {
  return createInitialState(canvasWidth, canvasHeight, state.highScore);
}
