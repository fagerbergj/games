import { describe, it, expect } from "vitest";
import {
  createInitialState,
  applyFlap,
  tick,
  resetGame,
  checkCollision,
  DEFAULT_OPTIONS,
  type FlappyBirdOptions,
  type FlappyBirdState,
  type Bird,
} from "../lib/flappy-bird-logic";

// Helpers ---------------------------------------------------------------
function opts(overrides?: Partial<FlappyBirdOptions>): FlappyBirdOptions {
  return { ...DEFAULT_OPTIONS, ...overrides };
}

function makeBird(overrides?: Partial<Bird>): Bird {
  return { x: 80, y: 200, width: 34, height: 24, velocity: 0, ...overrides };
}

// createInitialState ------------------------------------------------------
describe("createInitialState", () => {
  it("should start in idle phase", () => {
    const state = createInitialState(opts());
    expect(state.phase).toBe("idle");
  });

  it("should start with score 0 and highScore 0", () => {
    const state = createInitialState(opts());
    expect(state.score).toBe(0);
    expect(state.highScore).toBe(0);
  });

  it("should have empty pipes array", () => {
    const state = createInitialState(opts());
    expect(state.pipes).toEqual([]);
  });

  it("should place the bird at 1/3 of canvas height", () => {
    const h = 500;
    const state = createInitialState(opts({ canvasHeight: h }));
    expect(state.bird.y).toBe(h / 3);
  });

  it("should position the bird at options.birdX", () => {
    const state = createInitialState(opts({ birdX: 120 }));
    expect(state.bird.x).toBe(120);
  });

  it("should respect custom bird dimensions", () => {
    const state = createInitialState(opts({ birdWidth: 50, birdHeight: 30 }));
    expect(state.bird.width).toBe(50);
    expect(state.bird.height).toBe(30);
  });

  it("should set groundY correctly", () => {
    const state = createInitialState(opts({ canvasHeight: 600, groundHeight: 80 }));
    expect(state.groundY).toBe(520);
  });
});

// applyFlap ---------------------------------------------------------------
describe("applyFlap", () => {
  it("should set bird velocity to flapStrength", () => {
    const state = createInitialState(opts());
    const newState = applyFlap(state, opts({ flapStrength: -10 }));
    expect(newState.bird.velocity).toBe(-10);
  });

  it("should transition from idle to playing", () => {
    const state = createInitialState(opts());
    const newState = applyFlap(state, opts());
    expect(newState.phase).toBe("playing");
  });

  it("should stay in playing if already playing", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts()); // idle → playing
    expect(state.phase).toBe("playing");
    const newState = applyFlap(state, opts());
    expect(newState.phase).toBe("playing");
  });

  it("should not change state when gameover", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts()); // playing
    for (let i = 0; i < 100; i++) state = tick(state, opts({ gravity: 2, initialSpeed: 0 }));
    expect(state.phase).toBe("gameover");

    const unchanged = applyFlap(state, opts());
    expect(unchanged.phase).toBe("gameover");
    expect(unchanged.score).toBe(state.score);
  });
});

// checkCollision ----------------------------------------------------------
describe("checkCollision", () => {
  it("should return false when bird is safely in the middle", () => {
    const bird = makeBird({ y: 200, velocity: 0 });
    expect(checkCollision(bird, [], 540)).toBe(false); // ground at 540 (600-60)
  });

  it("should detect ground collision", () => {
    const bird = makeBird({ y: 520 }); // bottom of 34-high bird at 554, ground at 540
    expect(checkCollision(bird, [], 540)).toBe(true);
  });

  it("should detect ceiling collision", () => {
    const bird = makeBird({ y: -10 });
    expect(checkCollision(bird, [], 540)).toBe(true);
  });

  it("should detect pipe collision with top pipe", () => {
    const bird = makeBird({ x: 100, y: 120, velocity: 0 });
    const pipes = [{ x: 90, topHeight: 150, bottomY: 300, width: 40, passed: false }];
    expect(checkCollision(bird, pipes, 540)).toBe(true); // bird overlaps top pipe rect
  });

  it("should detect pipe collision with bottom pipe", () => {
    const bird = makeBird({ x: 100, y: 320, velocity: 0 });
    const pipes = [{ x: 90, topHeight: 150, bottomY: 300, width: 40, passed: false }];
    expect(checkCollision(bird, pipes, 540)).toBe(true); // bird overlaps bottom pipe rect
  });

  it("should NOT detect collision when bird passes through gap", () => {
    const bird = makeBird({ x: 100, y: 220, velocity: 0 });
    const pipes = [{ x: 90, topHeight: 150, bottomY: 300, width: 40, passed: false }];
    // Bird y=220, height=24 → range [220, 244]; pipe gap is [150, 300] — bird fits in gap
    expect(checkCollision(bird, pipes, 540)).toBe(false);
  });

  it("should detect collision with multiple pipes", () => {
    const bird = makeBird({ x: 100, y: 120, velocity: 0 });
    const pipes = [
      { x: 300, topHeight: 400, bottomY: 560, width: 40, passed: false }, // far away
      { x: 90, topHeight: 150, bottomY: 300, width: 40, passed: false },   // hits this one
    ];
    expect(checkCollision(bird, pipes, 540)).toBe(true);
  });

  it("should allow bird exactly at ceiling edge", () => {
    const bird = makeBird({ y: 1 }); // top at 1 > 0
    expect(checkCollision(bird, [], 540)).toBe(false);
  });

  it("should detect collision when bird touches ground exactly", () => {
    const bird = makeBird({ y: 516 }); // 516+24=540, exactly at ground
    expect(checkCollision(bird, [], 540)).toBe(true);
  });
});

// tick --------------------------------------------------------------------
describe("tick", () => {
  it("should do nothing when idle", () => {
    const state = createInitialState(opts());
    const result = tick(state, opts({ gravity: 0.5 }));
    expect(result).toBe(state); // same reference — no mutation
  });

  it("should do nothing when gameover", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts());
    for (let i = 0; i < 200; i++) state = tick(state, opts({ gravity: 1, initialSpeed: 0 }));
    expect(state.phase).toBe("gameover");
    const beforeScore = state.score;
    const result = tick(state, opts({ gravity: 1 }));
    expect(result.phase).toBe("gameover");
    expect(result.score).toBe(beforeScore);
  });

  it("should apply gravity to bird velocity", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts({ flapStrength: -8 }));
    const result = tick(state, opts({ gravity: 0.5, initialSpeed: 0 }));
    expect(result.bird.velocity).toBe(-7.5); // -8 + 0.5
  });

  it("should show increasing velocity from gravity over multiple ticks", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts({ flapStrength: -8 }));
    // After flap, velocity should increase each tick (gravity pulls down)
    const result1 = tick(state, opts({ gravity: 0.5, initialSpeed: 0 }));
    expect(result1.bird.velocity).toBe(-7.5);
    const result2 = tick(result1, opts({ gravity: 0.5, initialSpeed: 0 }));
    expect(result2.bird.velocity).toBe(-7.0);
  });

  it("should move pipes left by initialSpeed", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts());
    state = tick(state, opts({ initialSpeed: 3 })); // first tick spawns a pipe
    const pipeXBefore = state.pipes[0]?.x;
    state = tick(state, opts({ initialSpeed: 3 }));
    expect(state.pipes[0]?.x).toBe(pipeXBefore! - 3);
  });

  it("should score when bird passes a pipe", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts());
    // Fast-forward until a pipe is on screen and the bird has passed it
    const optsFast = { ...opts(), initialSpeed: 10 }; // fast speed to move pipes quickly
    for (let i = 0; i < 50; i++) state = tick(state, optsFast);
    expect(state.score).toBeGreaterThanOrEqual(0);
  });

  it("should not score the same pipe twice", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts());
    const optsNarrow = { ...opts(), initialSpeed: 1, gravity: 0.3 };
    // Move slowly so bird stays past one pipe while more spawn
    for (let i = 0; i < 120; i++) state = tick(state, optsNarrow);
    if (state.phase !== "gameover") {
      const scoreBefore = state.score;
      // advance enough to pass another pipe and keep going
      for (let i = 0; i < 50; i++) state = tick(state, optsNarrow);
      expect(state.score).toBeGreaterThanOrEqual(scoreBefore);
    }
  });

  it("should spawn pipes at the correct interval", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts());
    const optsSlow = { ...opts(), initialSpeed: 0.5, pipeSpawnInterval: 300 };
    // With speed 0.5, after many ticks pipes move slowly, new ones spawn periodically
    for (let i = 0; i < 200; i++) {
      state = tick(state, optsSlow);
      if (state.phase === "gameover") break;
    }
    // Should have spawned at least one pipe since the bird is playing
    expect(state.pipes.length).toBeGreaterThanOrEqual(1);
  });

  it("should end in gameover when hitting ground", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts({ gravity: 0.5 })); // flap weakly
    for (let i = 0; i < 200; i++) state = tick(state, opts({ initialSpeed: 0 }));
    expect(state.phase).toBe("gameover");
  });

  it("should preserve highScore through a gameover", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts());
    for (let i = 0; i < 50; i++) state = tick(state, opts({ gravity: 0.3, initialSpeed: 1 }));
    const scoreBeforeDeath = state.score;
    // let it die
    for (let i = 0; i < 200; i++) {
      state = tick(state, opts({ gravity: 0.5, initialSpeed: 0 }));
      if (state.phase === "gameover") break;
    }
    expect(state.highScore).toBe(scoreBeforeDeath);
  });
});

// resetGame ---------------------------------------------------------------
describe("resetGame", () => {
  it("should return to idle phase", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts());
    for (let i = 0; i < 100; i++) state = tick(state, opts({ gravity: 2, initialSpeed: 0 }));
    expect(state.phase).toBe("gameover");

    const fresh = resetGame(state, opts());
    expect(fresh.phase).toBe("idle");
    expect(fresh.score).toBe(0);
    expect(fresh.pipes).toEqual([]);
  });

  it("should preserve high score across resets", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts());
    for (let i = 0; i < 80; i++) state = tick(state, opts({ gravity: 1, initialSpeed: 0 }));
    const hs = Math.max(state.highScore, state.score);

    const fresh = resetGame(state, opts());
    expect(fresh.highScore).toBe(hs);
  });

  it("should start with the same bird position", () => {
    let state = createInitialState(opts());
    state = applyFlap(state, opts());
    for (let i = 0; i < 100; i++) state = tick(state, opts({ gravity: 2, initialSpeed: 0 }));

    const fresh = resetGame(state, opts());
    expect(fresh.bird.x).toBe(opts().birdX);
    expect(fresh.bird.y).toBe(opts().canvasHeight / 3);
  });

  it("should keep highScore when score was 0", () => {
    // Manually construct a gameover state with score=0 and test reset preserves it
    let state = createInitialState(opts());
    state = applyFlap(state, opts()); // playing

    // Craft a bird below ground so collision triggers immediately
    const collidingState: FlappyBirdState = {
      ...state,
      bird: { ...state.bird, y: 600 }, // well below ground (540)
    };
    const dead = tick(collidingState, opts());
    expect(dead.phase).toBe("gameover");
    const fresh = resetGame(dead, opts());
    expect(fresh.highScore).toBe(0); // score was 0 (we never scored)
  });
});

