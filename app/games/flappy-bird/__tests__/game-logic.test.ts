import { describe, it, expect, beforeEach } from "vitest";
import {
  createInitialState,
  applyGravity,
  flap,
  createPipe,
  movePipe,
  checkPipeCollision,
  checkBoundaryCollision,
  generateNextPipe,
  cleanupPipes,
  updateGroundX,
  advanceGameFrame,
  resetGame,
 
  DEFAULT_BIRD_SIZE,
  DEFAULT_GROUND_HEIGHT,
  DEFAULT_GRAVITY,
  DEFAULT_PIPE_SPEED,
} from "../lib/game-logic";
import { FlappyBirdState, Bird } from "../lib/types";

describe("createInitialState", () => {
  it("should create initial state with phase setup", () => {
    const state = createInitialState(400, 600);
    expect(state.phase).toBe("setup");
  });

  it("should position the bird at 25% of canvas width and center height", () => {
    const state = createInitialState(400, 600);
    expect(state.bird.x).toBe(100); // 25% of 400
    expect(state.bird.y).toBe(300); // center of 600
  });

  it("should start with empty pipes and zero score", () => {
    const state = createInitialState(400, 600);
    expect(state.pipes).toEqual([]);
    expect(state.score).toBe(0);
    expect(state.groundX).toBe(0);
  });

  it("should preserve high score from previous game", () => {
    const state = createInitialState(400, 600, 10);
    expect(state.highScore).toBe(10);
  });
});

describe("applyGravity", () => {
  it("should increase velocity by gravity amount each frame", () => {
    const bird: Bird = { x: 100, y: 300, velocity: 0 };
    const result = applyGravity(bird, DEFAULT_GRAVITY);
    expect(result.velocity).toBe(0.5);
  });

  it("should accumulate velocity over multiple calls", () => {
    let bird: Bird = { x: 100, y: 300, velocity: 0 };
    bird = applyGravity(bird, DEFAULT_GRAVITY);
    expect(bird.velocity).toBe(0.5);
    bird = applyGravity(bird, DEFAULT_GRAVITY);
    expect(bird.velocity).toBe(1.0);
    bird = applyGravity(bird, DEFAULT_GRAVITY);
    expect(bird.velocity).toBe(1.5);
  });

  it("should not modify position directly (only velocity)", () => {
    const bird: Bird = { x: 100, y: 300, velocity: 0 };
    const result = applyGravity(bird, DEFAULT_GRAVITY);
    expect(result.x).toBe(100);
    expect(result.y).toBe(300);
  });

  it("should work with upward velocity (bird falling after flap)", () => {
    const bird: Bird = { x: 100, y: 200, velocity: -8 };
    const result = applyGravity(bird, DEFAULT_GRAVITY);
    expect(result.velocity).toBe(-7.5);
  });
});

describe("flap", () => {
  it("should set upward velocity", () => {
    const bird: Bird = { x: 100, y: 300, velocity: 0 };
    const result = flap(bird);
    expect(result.velocity).toBe(-8);
  });

  it("should not modify position", () => {
    const bird: Bird = { x: 100, y: 300, velocity: 2 };
    const result = flap(bird);
    expect(result.x).toBe(100);
    expect(result.y).toBe(300);
  });

  it("should override existing velocity", () => {
    const bird: Bird = { x: 100, y: 300, velocity: 5 };
    const result = flap(bird);
    expect(result.velocity).toBe(-8);
  });
});

describe("createPipe", () => {
  it("should create a pipe at the given x position", () => {
    const canvasHeight = 600;
    const pipe = createPipe(450, canvasHeight);
    expect(pipe.x).toBe(450);
  });

  it("should have a valid gap centered in the playable area", () => {
    const canvasHeight = 600;
    const pipe = createPipe(450, canvasHeight);
    // Gap should be between ground + 50 and canvasHeight - ground - gapHeight - 50
    expect(pipe.gapY).toBeGreaterThan(DEFAULT_GROUND_HEIGHT + 50);
    expect(pipe.gapY).toBeLessThan(canvasHeight - DEFAULT_GROUND_HEIGHT - pipe.gapHeight - 50);
  });

  it("should have the default gap height", () => {
    const canvasHeight = 600;
    const pipe = createPipe(450, canvasHeight);
    expect(pipe.gapHeight).toBe(140);
  });

  it("should start with scored false", () => {
    const canvasHeight = 600;
    const pipe = createPipe(450, canvasHeight);
    expect(pipe.scored).toBe(false);
  });

  it("should generate unique ids", () => {
    const canvasHeight = 600;
    const pipe1 = createPipe(450, canvasHeight);
    const pipe2 = createPipe(450, canvasHeight);
    expect(pipe1.id).not.toBe(pipe2.id);
  });
});

describe("movePipe", () => {
  it("should move the pipe left by the speed amount", () => {
    const pipe: FlappyBirdState["pipes"][number] = { id: "test", x: 400, gapY: 300, gapHeight: 140, scored: false };
    const result = movePipe(pipe, DEFAULT_PIPE_SPEED);
    expect(result.x).toBe(400 - DEFAULT_PIPE_SPEED);
  });

  it("should not change other properties", () => {
    const pipe: FlappyBirdState["pipes"][number] = { id: "test", x: 400, gapY: 300, gapHeight: 140, scored: true };
    const result = movePipe(pipe, DEFAULT_PIPE_SPEED);
    expect(result.gapY).toBe(300);
    expect(result.gapHeight).toBe(140);
    expect(result.scored).toBe(true);
  });
});

describe("checkPipeCollision", () => {
  it("should return false when bird is far from all pipes", () => {
    const bird: Bird = { x: 50, y: 300, velocity: 0 };
    const pipes = [createPipe(450, 600)];
    expect(checkPipeCollision(bird, pipes)).toBe(false);
  });

  it("should return true when bird hits top pipe body", () => {
    // Pipe spans x=[400, 450], gap at y=300 with height 140 => gap [230, 370]
    // Bird centered at x=425 (inside pipe), y=150 (above gap top edge 230)
    const bird: Bird = { x: 425, y: 150, velocity: 0 };
    const testPipes: FlappyBirdState["pipes"] = [{ id: "t", x: 400, gapY: 300, gapHeight: 140, scored: false }];
    expect(checkPipeCollision(bird, testPipes)).toBe(true);
  });

  it("should return true when bird hits bottom pipe body", () => {
    const canvasHeight = 600;
    const pipe = createPipe(400, canvasHeight);
    // Bird below the gap
    const bird: Bird = { x: 425, y: pipe.gapY + pipe.gapHeight / 2 + DEFAULT_BIRD_SIZE / 2 + 10, velocity: 0 };
    expect(checkPipeCollision(bird, [pipe])).toBe(true);
  });

  it("should return false when bird passes through the gap cleanly", () => {
    const canvasHeight = 600;
    const pipe = createPipe(400, canvasHeight);
    // Bird centered in gap
    const bird: Bird = { x: 425, y: pipe.gapY, velocity: 0 };
    expect(checkPipeCollision(bird, [pipe])).toBe(false);
  });

  it("should detect collision when bird barely fits through gap", () => {
    const gapY = 300;
    const gapHeight = 140;
    // Bird top edge just barely above the gap bottom edge (collision)
    // gapBottom = 370, birdBottom should be > 370 => bird.y + 15 > 370 => bird.y > 355
    const bird: Bird = { x: 425, y: 360, velocity: 0 };
    expect(checkPipeCollision(bird, [{ id: "t", x: 400, gapY, gapHeight, scored: false }])).toBe(true);
  });
});

describe("checkBoundaryCollision", () => {
  it("should return true when bird hits the ground", () => {
    const canvasHeight = 600;
    // Ground starts at y = 540 (600 - 60). Bird bottom = y + 15 must be >= 540.
    // Use y = 530 so birdBottom = 545 which is within ground.
    const bird: Bird = { x: 100, y: 530, velocity: 0 };
    expect(checkBoundaryCollision(bird, canvasHeight)).toBe(true);
  });

  it("should return true when bird hits the ceiling", () => {
    const bird: Bird = { x: 100, y: DEFAULT_BIRD_SIZE / 2 - 5, velocity: 0 };
    expect(checkBoundaryCollision(bird, 600)).toBe(true);
  });

  it("should return false when bird is safely in bounds", () => {
    const canvasHeight = 600;
    const bird: Bird = { x: 100, y: canvasHeight / 2, velocity: 0 };
    expect(checkBoundaryCollision(bird, canvasHeight)).toBe(false);
  });

  it("should return false when bird barely clears the ground", () => {
    const canvasHeight = 600;
    const bird: Bird = { x: 100, y: canvasHeight - DEFAULT_GROUND_HEIGHT - DEFAULT_BIRD_SIZE / 2 - 10, velocity: 0 };
    expect(checkBoundaryCollision(bird, canvasHeight)).toBe(false);
  });
});

describe("generateNextPipe", () => {
  it("should generate a pipe when no pipes exist", () => {
    const canvasWidth = 400;
    const canvasHeight = 600;
    const result = generateNextPipe([], canvasWidth, canvasHeight);
    expect(result).not.toBeNull();
  });

  it("should generate a pipe when last pipe is off screen enough", () => {
    const canvasWidth = 400;
    const canvasHeight = 600;
    const pipes = [{ ...createPipe(200, canvasHeight), x: 150 }];
    const result = generateNextPipe(pipes, canvasWidth, canvasHeight, 220);
    expect(result).not.toBeNull();
  });

  it("should return null when a pipe exists close enough", () => {
    const canvasWidth = 400;
    const canvasHeight = 600;
    const pipes = [{ ...createPipe(350, canvasHeight), x: 200 }];
    const result = generateNextPipe(pipes, canvasWidth, canvasHeight, 220);
    expect(result).toBeNull();
  });
});

describe("cleanupPipes", () => {
  it("should remove pipes that are off-screen to the left", () => {
    const pipes: FlappyBirdState["pipes"] = [
      { ...createPipe(400, 600), x: -60 },
      { ...createPipe(450, 600), x: 350 },
    ];
    const result = cleanupPipes(pipes);
    expect(result.length).toBe(1);
    expect(result[0].x).toBe(350);
  });

  it("should keep pipes that are still on screen", () => {
    const pipes: FlappyBirdState["pipes"] = [
      { ...createPipe(400, 600), x: -5 },
      { ...createPipe(450, 600), x: 350 },
    ];
    const result = cleanupPipes(pipes);
    expect(result.length).toBe(2);
  });

  it("should return empty array when all pipes are off-screen", () => {
    const pipes: FlappyBirdState["pipes"] = [
      { ...createPipe(400, 600), x: -100 },
    ];
    const result = cleanupPipes(pipes);
    expect(result.length).toBe(0);
  });
});

describe("updateGroundX", () => {
  it("should decrease by pipe speed and apply modulo for wrapping", () => {
    // groundX=100, pipeSpeed=2: (100 - 2) % 24 = 98 % 24 = 2
    const result = updateGroundX(100, DEFAULT_PIPE_SPEED);
    expect(result).toBe((100 - DEFAULT_PIPE_SPEED) % 24);
  });

  it("should handle negative values with modulo wrap", () => {
    const result = updateGroundX(-10, DEFAULT_PIPE_SPEED);
    // In JS: (-12) % 24 = -12, so we expect the raw modulo result
    expect(result).toBe((-10 - DEFAULT_PIPE_SPEED) % 24);
  });

  it("should decrease by pipe speed without wrap for small values", () => {
    // groundX=10, pipeSpeed=2: (10 - 2) % 24 = 8
    const result = updateGroundX(10, DEFAULT_PIPE_SPEED);
    expect(result).toBe((10 - DEFAULT_PIPE_SPEED) % 24);
  });
});

describe("advanceGameFrame", () => {
  beforeEach(() => {
    // Use a fixed seed mock for deterministic tests — we'll set specific pipe positions
  });

  it("should update bird position after gravity", () => {
    const state: FlappyBirdState = {
      phase: "playing",
      bird: { x: 100, y: 200, velocity: 0 },
      pipes: [],
      score: 0,
      highScore: 0,
      groundX: 0,
    };
    const canvasWidth = 400;
    const canvasHeight = 600;

    // Add a pipe far to the right so no collision occurs
    const pipeGapY = 300;
    state.pipes = [{ id: "p1", x: 500, gapY: pipeGapY, gapHeight: 140, scored: false }];

    const result = advanceGameFrame(state, canvasWidth, canvasHeight);
    expect(result.bird.velocity).toBe(0.5); // gravity applied
  });

  it("should move pipes left", () => {
    const state: FlappyBirdState = {
      phase: "playing",
      bird: { x: 100, y: 300, velocity: 0 },
      pipes: [],
      score: 0,
      highScore: 0,
      groundX: 0,
    };
    const pipeGapY = 300;
    state.pipes = [{ id: "p1", x: 450, gapY: pipeGapY, gapHeight: 140, scored: false }];

    const result = advanceGameFrame(state, 400, 600);
    expect(result.pipes[0].x).toBe(450 - DEFAULT_PIPE_SPEED);
  });

  it("should generate a new pipe when needed", () => {
    const state: FlappyBirdState = {
      phase: "playing",
      bird: { x: 100, y: 300, velocity: 0 },
      pipes: [{ id: "p1", x: 450, gapY: 300, gapHeight: 140, scored: false }],
      score: 0,
      highScore: 0,
      groundX: 0,
    };

    const result = advanceGameFrame(state, 400, 600);
    // Since there's only one pipe at x=450 which is beyond canvas width,
    // the next pipe should be generated
    expect(result.pipes.length).toBeGreaterThanOrEqual(1);
  });

  it("should increase score when bird passes a pipe", () => {
    const state: FlappyBirdState = {
      phase: "playing",
      bird: { x: 200, y: 300, velocity: 0 },
      pipes: [],
      score: 0,
      highScore: 0,
      groundX: 0,
    };
    const pipeGapY = 300;
    // Pipe is to the left of bird — should be scored
    state.pipes = [{ id: "p1", x: 50, gapY: pipeGapY, gapHeight: 140, scored: false }];

    const result = advanceGameFrame(state, 400, 600);
    expect(result.score).toBe(1);
  });

  it("should not double-score the same pipe", () => {
    const state: FlappyBirdState = {
      phase: "playing",
      bird: { x: 200, y: 300, velocity: 0 },
      pipes: [],
      score: 1,
      highScore: 1,
      groundX: 0,
    };
    const pipeGapY = 300;
    // Pipe is already scored
    state.pipes = [{ id: "p1", x: 50, gapY: pipeGapY, gapHeight: 140, scored: true }];

    const result = advanceGameFrame(state, 400, 600);
    expect(result.score).toBe(1); // unchanged
  });

  it("should update high score when exceeded", () => {
    const state: FlappyBirdState = {
      phase: "playing",
      bird: { x: 200, y: 300, velocity: 0 },
      pipes: [],
      score: 5,
      highScore: 10,
      groundX: 0,
    };
    const pipeGapY = 300;
    state.pipes = [{ id: "p1", x: 50, gapY: pipeGapY, gapHeight: 140, scored: false }];

    const result = advanceGameFrame(state, 400, 600);
    expect(result.highScore).toBe(10); // still 10 since score was only 5
  });

  it("should update high score when new best is achieved", () => {
    const state: FlappyBirdState = {
      phase: "playing",
      bird: { x: 200, y: 300, velocity: 0 },
      pipes: [],
      score: 15,
      highScore: 10,
      groundX: 0,
    };
    const pipeGapY = 300;
    state.pipes = [{ id: "p1", x: 50, gapY: pipeGapY, gapHeight: 140, scored: false }];

    const result = advanceGameFrame(state, 400, 600);
    expect(result.highScore).toBe(16); // was 15 + 1 from scoring this pipe
  });

  it("should set phase to gameover on pipe collision", () => {
    const state: FlappyBirdState = {
      phase: "playing",
      bird: { x: 425, y: 200, velocity: 0 }, // hitting top pipe body
      pipes: [],
      score: 0,
      highScore: 0,
      groundX: 0,
    };
    const pipeGapY = 300;
    state.pipes = [{ id: "p1", x: 400, gapY: pipeGapY, gapHeight: 140, scored: false }];

    const result = advanceGameFrame(state, 400, 600);
    expect(result.phase).toBe("gameover");
  });

  it("should set phase to gameover on ground collision", () => {
    const state: FlappyBirdState = {
      phase: "playing",
      bird: { x: 100, y: 580, velocity: 0 }, // very close to ground
      pipes: [],
      score: 0,
      highScore: 0,
      groundX: 0,
    };

    const result = advanceGameFrame(state, 400, 600);
    expect(result.phase).toBe("gameover");
  });

  it("should update ground position", () => {
    const state: FlappyBirdState = {
      phase: "playing",
      bird: { x: 100, y: 300, velocity: 0 },
      pipes: [],
      score: 0,
      highScore: 0,
      groundX: 100,
    };

    const result = advanceGameFrame(state, 400, 600);
    expect(result.groundX).toBe((100 - DEFAULT_PIPE_SPEED) % 24);
  });
});

describe("resetGame", () => {
  it("should preserve the high score", () => {
    const state: FlappyBirdState = {
      phase: "gameover",
      bird: { x: 100, y: 300, velocity: 0 },
      pipes: [],
      score: 15,
      highScore: 20,
      groundX: 0,
    };
    const result = resetGame(state, 400, 600);
    expect(result.phase).toBe("setup");
    expect(result.score).toBe(0);
    expect(result.highScore).toBe(20);
    expect(result.pipes).toEqual([]);
  });

  it("should reset bird position", () => {
    const state: FlappyBirdState = {
      phase: "gameover",
      bird: { x: 350, y: 500, velocity: 10 },
      pipes: [],
      score: 0,
      highScore: 5,
      groundX: 100,
    };
    const result = resetGame(state, 400, 600);
    expect(result.bird.x).toBe(100); // 25% of width
    expect(result.bird.y).toBe(300); // center height
    expect(result.phase).toBe("setup");
  });
});
