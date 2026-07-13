import { GameState, Bird, Pipe } from "./types";

export const INITIAL_BIRD: Omit<Bird, "id"> = {
  x: 80,
  y: 200,
  velocity: 0,
  width: 34,
  height: 24,
};

export const DEFAULT_SETTINGS: {
  GRAVITY: number;
  FLAP_STRENGTH: number;
  PIPE_SPEED: number;
  PIPE_GAP: number;
  PIPE_WIDTH: number;
  PIPE_SPAWN_INTERVAL: number;
} = {
  GRAVITY: 0.5,
  FLAP_STRENGTH: -8,
  PIPE_SPEED: 2,
  PIPE_GAP: 140,
  PIPE_WIDTH: 52,
  PIPE_SPAWN_INTERVAL: 100,
};

function createPipe(x: number, canvasHeight: number): Pipe {
  const minTop = 50;
  const maxTop = canvasHeight - DEFAULT_SETTINGS.PIPE_GAP - 50;
  const topHeight = Math.floor(Math.random() * (maxTop - minTop)) + minTop;
  return {
    id: crypto.randomUUID(),
    x,
    topHeight,
    bottomY: topHeight + DEFAULT_SETTINGS.PIPE_GAP,
    width: DEFAULT_SETTINGS.PIPE_WIDTH,
    passed: false,
  };
}

export function createInitialState(canvasWidth: number, canvasHeight: number): GameState {
  return {
    phase: "ready",
    score: 0,
    bird: { ...INITIAL_BIRD, id: crypto.randomUUID() },
    pipes: [],
    frameCount: 0,
    canvasWidth,
    canvasHeight,
    highScore: 0,
  };
}

export function flap(bird: Bird): Bird {
  return { ...bird, velocity: DEFAULT_SETTINGS.FLAP_STRENGTH };
}

export function updateBird(bird: Bird, gravity: number): Bird {
  const newVelocity = bird.velocity + gravity;
  let newY = bird.y + newVelocity;
  if (newY < 0) newY = 0;
  return { ...bird, velocity: newVelocity, y: newY };
}

export function spawnPipes(pipes: Pipe[], frameCount: number): Pipe[] {
  const newPipes = [...pipes];
  if (frameCount % DEFAULT_SETTINGS.PIPE_SPAWN_INTERVAL === 0) {
    const lastPipe = pipes[pipes.length - 1];
    const x = lastPipe ? lastPipe.x + 300 : 500;
    newPipes.push(createPipe(x, 500));
  }
  return newPipes;
}

export function updatePipes(
  pipes: Pipe[],
  speed: number,
): { pipes: Pipe[]; scored: string[] } {
  const updated = pipes.map((p) => ({ ...p, x: p.x - speed }));
  const scored: string[] = [];
  for (const pipe of updated) {
    if (!pipe.passed && pipe.x + pipe.width < INITIAL_BIRD.x) {
      pipe.passed = true;
      scored.push(pipe.id);
    }
  }
  return { pipes: updated.filter((p) => p.x + p.width > -100), scored };
}

export function checkCollision(bird: Bird, pipes: Pipe[]): boolean {
  const bx = bird.x;
  const by = bird.y;
  const bw = bird.width;
  const bh = bird.height;

  if (by <= 0 || by + bh >= 500) return true;

  for (const pipe of pipes) {
    if (bx + bw > pipe.x && bx < pipe.x + pipe.width) {
      if (by < pipe.topHeight || by + bh > pipe.bottomY) {
        return true;
      }
    }
  }
  return false;
}

export function resetBird(bird: Bird): Bird {
  return { ...bird, y: INITIAL_BIRD.y, velocity: 0 };
}
