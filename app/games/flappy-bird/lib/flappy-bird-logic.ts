export interface Bird {
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: number;
}

export interface Pipe {
  x: number;
  topHeight: number;
  bottomY: number;
  width: number;
  passed: boolean;
}

export type GamePhase = "idle" | "playing" | "gameover";

export interface FlappyBirdState {
  phase: GamePhase;
  bird: Bird;
  pipes: Pipe[];
  score: number;
  highScore: number;
  groundY: number;
}

export interface FlappyBirdOptions {
  canvasWidth: number;
  canvasHeight: number;
  gravity: number;
  flapStrength: number;
  birdX: number;
  birdWidth: number;
  birdHeight: number;
  pipeWidth: number;
  pipeGap: number;
  pipeSpawnInterval: number; // min horizontal gap between consecutive pipes
  groundHeight: number;
  initialSpeed: number;
}

export const DEFAULT_OPTIONS: FlappyBirdOptions = {
  canvasWidth: 400,
  canvasHeight: 600,
  gravity: 0.5,
  flapStrength: -8,
  birdX: 80,
  birdWidth: 34,
  birdHeight: 24,
  pipeWidth: 52,
  pipeGap: 140,
  pipeSpawnInterval: 200,
  groundHeight: 60,
  initialSpeed: 2.5,
};

// -- Pure game logic functions -------------------------------------------------

/** Create a fresh idle state. */
export function createInitialState(options: FlappyBirdOptions): FlappyBirdState {
  const groundY = getGroundY(options.canvasHeight, options.groundHeight);
  const birdY = options.canvasHeight / 3;
  return {
    phase: "idle",
    bird: { x: options.birdX, y: birdY, width: options.birdWidth, height: options.birdHeight, velocity: 0 },
    pipes: [],
    score: 0,
    highScore: 0,
    groundY,
  };
}

/** Return a new state with the bird flapping (applies impulse). */
export function applyFlap(state: FlappyBirdState, options: FlappyBirdOptions): FlappyBirdState {
  if (state.phase === "gameover") return state;
  const newBird = { ...state.bird, velocity: options.flapStrength };
  return { ...state, bird: newBird, phase: state.phase === "idle" ? "playing" : state.phase };
}

/** Advance physics / pipe movement / scoring for one tick. */
export function tick(state: FlappyBirdState, options: FlappyBirdOptions): FlappyBirdState {
  if (state.phase !== "playing") return state;

  const { gravity, pipeWidth, pipeGap, pipeSpawnInterval, initialSpeed } = options;
  const newGroundY = getGroundY(options.canvasHeight, options.groundHeight);
  const speed = initialSpeed;

  // Bird physics
  const newVelocity = state.bird.velocity + gravity;
  const newBird = {
    ...state.bird,
    velocity: newVelocity,
    y: state.bird.y + newVelocity,
  };

  // Move pipes, score on pass
  let newScore = state.score;
  const movedPipes: Pipe[] = [];

  for (const pipe of state.pipes) {
    const newX = pipe.x - speed;

    if (!pipe.passed && pipe.x + pipe.width < newBird.x) {
      newScore += 1;
      movedPipes.push({ ...pipe, x: newX, passed: true });
    } else if (newX > -(pipeWidth + 10)) {
      movedPipes.push({ ...pipe, x: newX });
    }
    // discard fully off-screen left
  }

  // Spawn new pipes
  const lastPipe = movedPipes[movedPipes.length - 1] ?? null;
  if (!lastPipe || (options.canvasWidth - (lastPipe.x + pipeWidth)) >= pipeSpawnInterval) {
    const minTop = 40;
    const maxTop = newGroundY - pipeGap - 40;
    const topHeight = minTop + Math.random() * (maxTop - minTop);
    movedPipes.push({
      x: options.canvasWidth,
      topHeight,
      bottomY: topHeight + pipeGap,
      width: pipeWidth,
      passed: false,
    });
  }

  // Collision check
  if (checkCollision(newBird, movedPipes, newGroundY)) {
    return {
      ...state,
      bird: newBird,
      pipes: movedPipes,
      score: newScore,
      phase: "gameover",
      highScore: Math.max(state.highScore, newScore),
    };
  }

  return {
    ...state,
    bird: newBird,
    pipes: movedPipes,
    score: newScore,
  };
}

/** Check whether the bird collides with any pipe or the ground/ceiling. */
export function checkCollision(
  bird: Bird,
  pipes: Pipe[],
  groundY: number,
): boolean {
  if (bird.y + bird.height >= groundY) return true;
  if (bird.y <= 0) return true;

  for (const pipe of pipes) {
    if (bird.x + bird.width > pipe.x && bird.x < pipe.x + pipe.width) {
      if (bird.y < pipe.topHeight || bird.y + bird.height > pipe.bottomY) {
        return true;
      }
    }
  }

  return false;
}

/** Reset to fresh state, preserving high score. */
export function resetGame(state: FlappyBirdState, options: FlappyBirdOptions): FlappyBirdState {
  const fresh = createInitialState(options);
  return { ...fresh, highScore: Math.max(state.highScore, state.score) };
}

function getGroundY(canvasHeight: number, groundHeight: number): number {
  return canvasHeight - groundHeight;
}
