import { describe, it, expect } from "vitest";
import {
  INITIAL_BIRD,
  DEFAULT_SETTINGS,
  createInitialState,
  flap,
  updateBird,
  spawnPipes,
  updatePipes,
  checkCollision,
  resetBird,
} from "../lib/gameLogic";
import { GameState } from "../lib/types";

describe("createInitialState", () => {
  it("returns ready phase with score 0 and empty pipes", () => {
    const state = createInitialState(400, 500);
    expect(state.phase).toBe("ready");
    expect(state.score).toBe(0);
    expect(state.pipes).toEqual([]);
    expect(state.frameCount).toBe(0);
    expect(state.canvasWidth).toBe(400);
    expect(state.canvasHeight).toBe(500);
  });

  it("bird has initial properties", () => {
    const state = createInitialState(400, 500);
    expect(state.bird.x).toBe(80);
    expect(state.bird.y).toBe(200);
    expect(state.bird.velocity).toBe(0);
  });
});

describe("flap", () => {
  it("sets velocity to flap strength", () => {
    const bird = { ...INITIAL_BIRD, id: "1" };
    const flapped = flap(bird);
    expect(flapped.velocity).toBe(DEFAULT_SETTINGS.FLAP_STRENGTH);
    expect(flapped.y).toBe(INITIAL_BIRD.y); // position unchanged
  });
});

describe("updateBird", () => {
  it("applies gravity to velocity and updates position", () => {
    const bird = { ...INITIAL_BIRD, id: "1", velocity: -5 };
    const updated = updateBird(bird, DEFAULT_SETTINGS.GRAVITY);
    expect(updated.velocity).toBe(-5 + DEFAULT_SETTINGS.GRAVITY);
    expect(updated.y).toBeCloseTo(INITIAL_BIRD.y + (-5 + DEFAULT_SETTINGS.GRAVITY));
  });

  it("clamps y to minimum of 0", () => {
    const bird = { ...INITIAL_BIRD, id: "1", y: -10 };
    const updated = updateBird(bird, DEFAULT_SETTINGS.GRAVITY);
    expect(updated.y).toBe(0);
  });

  it("velocity increases over repeated updates (gravity pulls down)", () => {
    let bird = { ...INITIAL_BIRD, id: "1", velocity: 0 };
    for (let i = 0; i < 20; i++) {
      bird = updateBird(bird, DEFAULT_SETTINGS.GRAVITY);
    }
    expect(bird.velocity).toBeGreaterThan(0); // should be falling down
  });
});

describe("spawnPipes", () => {
  it("does not spawn pipes if interval not reached", () => {
    const pipes: GameState["pipes"] = [];
    const result = spawnPipes(pipes, 50);
    expect(result.length).toBe(0);
  });

  it("spawns a pipe at frameCount matching interval", () => {
    const pipes: GameState["pipes"] = [];
    const result = spawnPipes(pipes, DEFAULT_SETTINGS.PIPE_SPAWN_INTERVAL);
    expect(result.length).toBe(1);
    expect(result[0].x).toBe(500);
  });

  it("spawns second pipe at correct distance from first", () => {
    let pipes: GameState["pipes"] = [];
    pipes = spawnPipes(pipes, DEFAULT_SETTINGS.PIPE_SPAWN_INTERVAL);
    const result = spawnPipes(pipes, DEFAULT_SETTINGS.PIPE_SPAWN_INTERVAL * 2);
    expect(result.length).toBe(2);
    expect(result[1].x - result[0].x).toBe(300);
  });

  it("pipe has random gap within valid range", () => {
    const pipes: GameState["pipes"] = [];
    for (let i = 0; i < 5; i++) {
      const result = spawnPipes(pipes, DEFAULT_SETTINGS.PIPE_SPAWN_INTERVAL);
      expect(result[0].topHeight).toBeGreaterThan(49);
      expect(result[0].bottomY).toBeLessThan(500 - 1);
    }
  });
});

describe("updatePipes", () => {
  it("moves pipes left by speed", () => {
    const pipe = { id: "1", x: 400, topHeight: 200, bottomY: 340, width: DEFAULT_SETTINGS.PIPE_WIDTH, passed: false };
    const { pipes } = updatePipes([pipe], DEFAULT_SETTINGS.PIPE_SPEED);
    expect(pipes[0].x).toBe(398);
  });

  it("removes off-screen pipes", () => {
    const pipe = { id: "1", x: -200, topHeight: 200, bottomY: 340, width: DEFAULT_SETTINGS.PIPE_WIDTH, passed: false };
    const { pipes } = updatePipes([pipe], DEFAULT_SETTINGS.PIPE_SPEED);
    expect(pipes.length).toBe(0);
  });

  it("marks pipe as passed and returns scored ids", () => {
    const pipe = { id: "1", x: 27, topHeight: 200, bottomY: 340, width: DEFAULT_SETTINGS.PIPE_WIDTH, passed: false };
    const result = updatePipes([pipe], DEFAULT_SETTINGS.PIPE_SPEED);
    expect(result.scored).toContain("1");
  });
});

describe("checkCollision", () => {
  it("returns false with no pipes", () => {
    const bird = { ...INITIAL_BIRD, id: "1" };
    expect(checkCollision(bird, [])).toBe(false);
  });

  it("detects collision when bird is too high (ceiling)", () => {
    const bird = { ...INITIAL_BIRD, id: "1", y: -5 };
    expect(checkCollision(bird, [])).toBe(true);
  });

  it("detects collision with pipe body", () => {
    const pipe = { id: "1", x: INITIAL_BIRD.x - 10, topHeight: 100, bottomY: 240, width: DEFAULT_SETTINGS.PIPE_WIDTH, passed: false };
    const bird = { ...INITIAL_BIRD, id: "1", y: 80 }; // inside the pipe gap region
    expect(checkCollision(bird, [pipe])).toBe(true);
  });

  it("no collision when bird passes through gap safely", () => {
    const state = createInitialState(400, 500);
    const gapMid = state.canvasHeight / 2;
    const pipe = { ...DEFAULT_SETTINGS, id: "1", x: 900, topHeight: gapMid - 70 };
    const bird = { ...INITIAL_BIRD, id: "1" }; // far from pipe
    expect(checkCollision(bird, [pipe])).toBe(false);
  });
});

describe("resetBird", () => {
  it("resets y and velocity to initial values", () => {
    const bird = { ...INITIAL_BIRD, id: "1", y: 300, velocity: 5 };
    const reset = resetBird(bird);
    expect(reset.y).toBe(INITIAL_BIRD.y);
    expect(reset.velocity).toBe(0);
  });
});

describe("DEFAULT_SETTINGS consistency", () => {
  it("has all expected settings", () => {
    expect(typeof DEFAULT_SETTINGS.GRAVITY).toBe("number");
    expect(typeof DEFAULT_SETTINGS.FLAP_STRENGTH).toBe("number");
    expect(typeof DEFAULT_SETTINGS.PIPE_SPEED).toBe("number");
    expect(DEFAULT_SETTINGS.PIPE_GAP).toBe(140);
    expect(DEFAULT_SETTINGS.PIPE_WIDTH).toBe(52);
  });

  it("gravity is positive (pulls bird down)", () => {
    expect(DEFAULT_SETTINGS.GRAVITY).toBeGreaterThan(0);
  });

  it("flap strength is negative (pushes bird up)", () => {
    expect(DEFAULT_SETTINGS.FLAP_STRENGTH).toBeLessThan(0);
  });

  it("pipe speed is positive", () => {
    expect(DEFAULT_SETTINGS.PIPE_SPEED).toBeGreaterThan(0);
  });
});
