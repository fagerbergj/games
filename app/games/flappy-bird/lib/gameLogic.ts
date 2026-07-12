import type { Bird, Pipe, GameState, FlappyBirdState } from "./types";

export const config = {
  GRAVITY: 0.5,
  FLAP_STRENGTH: -8,
  PIPE_SPEED: 3,
  PIPE_GAP: 150,
  PIPE_WIDTH: 60,
  BIRD_SIZE: 30,
  GROUND_HEIGHT: 50,
  PIPE_INTERVAL: 1500,
};

export function createInitialState(
  canvasWidth: number,
  canvasHeight: number,
): FlappyBirdState {
  const groundY = canvasHeight - config.GROUND_HEIGHT;
  const bird: Bird = {
    y: groundY / 2,
    velocity: 0,
  };

  return {
    bird,
    pipes: [],
    score: 0,
    gameState: "start" as GameState,
    highScore: 0,
    groundY,
  };
}

export function flap(state: FlappyBirdState): FlappyBirdState {
  if (state.gameState === "gameover") {
    return resetGame(state);
  }

  const newState = startGameIfNeeded(state);

  if (newState.gameState === "start") {
    return state;
  }

  const bird = { ...newState.bird, velocity: config.FLAP_STRENGTH };

  return { ...newState, bird };
}

function startGameIfNeeded(state: FlappyBirdState): FlappyBirdState {
  if (state.gameState === "start") {
    return { ...state, gameState: "playing" as GameState };
  }
  return state;
}

export function resetGame(state: FlappyBirdState): FlappyBirdState {
  const groundY = state.groundY;
  const bird: Bird = { y: groundY / 2, velocity: 0 };

  return {
    ...state,
    bird,
    pipes: [],
    score: 0,
    gameState: "start" as GameState,
    highScore: state.score > state.highScore ? state.score : state.highScore,
  };
}

export function spawnPipe(
  canvasWidth: number,
  canvasHeight: number,
): Pipe {
  const minGapTop = config.GROUND_HEIGHT + config.PIPE_GAP / 2;
  const maxGapTop = canvasHeight - config.GROUND_HEIGHT - config.PIPE_GAP / 2;
  const gapTop = minGapTop + Math.random() * (maxGapTop - minGapTop);

  return { x: canvasWidth, gapTop, scored: false };
}

export function updatePipes(pipes: Pipe[]): Pipe[] {
  return pipes
    .map((pipe) => ({ ...pipe, x: pipe.x - config.PIPE_SPEED }))
    .filter((pipe) => pipe.x + config.PIPE_WIDTH > 0);
}

export function moveBird(
  bird: Bird,
  groundY: number,
): { bird: Bird; collision: boolean } {
  const newVelocity = bird.velocity + config.GRAVITY;
  const newY = bird.y + newVelocity;

  if (newY >= groundY - config.BIRD_SIZE) {
    return {
      bird: { y: groundY - config.BIRD_SIZE, velocity: 0 },
      collision: true,
    };
  }
  if (newY <= 0) {
    return {
      bird: { y: 0, velocity: newVelocity },
      collision: false,
    };
  }

  return { bird: { y: newY, velocity: newVelocity }, collision: false };
}

export function checkCollision(
  bird: { y: number },
  pipes: Pipe[],
  groundY: number,
): boolean {
  const birdLeft = 50; // Bird is always at x=50 in this implementation
  const birdRight = birdLeft + config.BIRD_SIZE;
  const birdTop = bird.y;
  const birdBottom = bird.y + config.BIRD_SIZE;

  if (birdBottom >= groundY) return true;
  if (birdTop <= 0) return true;

  for (const pipe of pipes) {
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + config.PIPE_WIDTH;

    if (birdRight > pipeLeft && birdLeft < pipeRight) {
      if (birdTop < pipe.gapTop || birdBottom > pipe.gapTop + config.PIPE_GAP) {
        return true;
      }
    }
  }

  return false;
}

export function updateScore(
  pipes: Pipe[],
  _canvasWidth: number,
  currentScore: number,
): { pipes: Pipe[]; score: number } {
  let newScore = currentScore;
  const updatedPipes = pipes.map((pipe) => {
    if (!pipe.scored && pipe.x + config.PIPE_WIDTH < 50) {
      newScore += 1;
      return { ...pipe, scored: true };
    }
    return pipe;
  });

  return { pipes: updatedPipes, score: newScore };
}

export function updateState(
  state: FlappyBirdState,
  canvasWidth: number,
  canvasHeight: number,
  currentTime: number,
  lastPipeSpawn: number,
): { state: FlappyBirdState; pipeSpawned: boolean } {
  if (state.gameState !== "playing") {
    return { state, pipeSpawned: false };
  }

  const moved = moveBird(state.bird, state.groundY);
  const collided = checkCollision(moved.bird, state.pipes, state.groundY);

  let newState: FlappyBirdState;
  let pipeSpawned = false;
  if (collided || moved.collision) {
    const highScore =
      Math.max(state.score, state.highScore);
    newState = { ...state, bird: moved.bird, gameState: "gameover" as GameState, highScore };
  } else {
    let updatedPipes = updatePipes(state.pipes);
    const scored = updateScore(updatedPipes, canvasWidth, state.score);

    updatedPipes = scored.pipes;

    // Spawn new pipe at intervals
    const timeSinceLastSpawn = currentTime - lastPipeSpawn;
    if (timeSinceLastSpawn >= config.PIPE_INTERVAL) {
      updatedPipes = [...updatedPipes, spawnPipe(canvasWidth, canvasHeight)];
      pipeSpawned = true;
    }

    newState = {
      ...state,
      bird: moved.bird,
      pipes: updatedPipes,
      score: scored.score,
    };
  }

  return { state: newState, pipeSpawned };
}
