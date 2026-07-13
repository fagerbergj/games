import { PIPE_GAP, BIRD_SIZE, GAME_WIDTH, GAME_HEIGHT } from "../lib/constants";
import {
  createInitialState,
  flapBird,
  applyGravity,
  movePipe,
  spawnPipe,
  checkCollision,
  updateScore,
  isPipeOffScreen,
} from "../lib/flappyBird";

describe("Flappy Bird Game Logic", () => {
  describe("createInitialState", () => {
    it("should return idle phase", () => {
      const state = createInitialState(0);
      expect(state.phase).toBe("idle");
    });

    it("should center the bird vertically", () => {
      const state = createInitialState(0);
      expect(state.bird.y).toBe(GAME_HEIGHT / 2 - BIRD_SIZE / 2);
    });

    it("should have zero velocity on start", () => {
      const state = createInitialState(0);
      expect(state.bird.velocity).toBe(0);
    });

    it("should start with no pipes", () => {
      const state = createInitialState(42);
      expect(state.pipes).toEqual([]);
    });

    it("should preserve high score from parameter", () => {
      const state = createInitialState(99);
      expect(state.highScore).toBe(99);
    });

    it("should start with zero score", () => {
      const state = createInitialState(0);
      expect(state.score).toBe(0);
    });
  });

  describe("flapBird", () => {
    it("should set velocity to -10", () => {
      const bird = { y: 300, velocity: 0 };
      const flapped = flapBird(bird);
      expect(flapped.velocity).toBe(-10);
    });

    it("should preserve the bird's y position", () => {
      const bird = { y: 250, velocity: 5 };
      const flapped = flapBird(bird);
      expect(flapped.y).toBe(250);
    });

    it("should not mutate the original bird", () => {
      const bird = { y: 300, velocity: 0 };
      const flapped = flapBird(bird);
      expect(bird.velocity).toBe(0);
      expect(flapped.velocity).toBe(-10);
    });
  });

  describe("applyGravity", () => {
    it("should increase downward velocity by gravity amount", () => {
      const bird = { y: 300, velocity: 0 };
      const result = applyGravity(bird, 0.6);
      expect(result.velocity).toBe(0.6);
    });

    it("should add gravity to new position", () => {
      const bird = { y: 300, velocity: 0 };
      const result = applyGravity(bird, 0.6);
      expect(result.y).toBe(300.6);
    });

    it("should clamp y at GAME_HEIGHT", () => {
      const bird = { y: GAME_HEIGHT - 1, velocity: 5 };
      const result = applyGravity(bird);
      expect(result.y).toBe(GAME_HEIGHT);
    });

    it("should handle negative velocity (going up)", () => {
      const bird = { y: 200, velocity: -8 };
      const result = applyGravity(bird, 0.6);
      expect(result.velocity).toBe(-7.4);
      expect(result.y).toBe(192.6);
    });
  });

  describe("movePipe", () => {
    it("should decrease x by pipe speed", () => {
      const pipe = { id: 1, x: 300, topHeight: 200, passed: false };
      const moved = movePipe(pipe);
      expect(moved.x).toBe(300 - 3); // PIPE_SPEED is 3
    });

    it("should preserve other pipe properties", () => {
      const pipe = { id: 1, x: 300, topHeight: 200, passed: false };
      const moved = movePipe(pipe);
      expect(moved.topHeight).toBe(200);
      expect(moved.passed).toBe(false);
      expect(moved.id).toBe(1);
    });
  });

  describe("spawnPipe", () => {
    it("should place pipe at the given x position", () => {
      const pipe = spawnPipe(400);
      expect(pipe.x).toBe(400);
    });

    it("should have a unique id", () => {
      const pipe1 = spawnPipe(400);
      const pipe2 = spawnPipe(500);
      expect(pipe1.id).not.toBe(pipe2.id);
    });

    it("should start with passed as false", () => {
      const pipe = spawnPipe(400);
      expect(pipe.passed).toBe(false);
    });

    it("should generate valid top height within bounds when using seed", () => {
      const minTop = 80;
      const maxTop = GAME_HEIGHT - PIPE_GAP - 80;

      for (let i = 0; i < 10; i++) {
        const pipe = spawnPipe(400, i);
        expect(pipe.topHeight).toBeGreaterThanOrEqual(minTop);
        expect(pipe.topHeight).toBeLessThanOrEqual(maxTop);
      }
    });

    it("should produce deterministic output with same seed", () => {
      const pipe1 = spawnPipe(400, 42);
      const pipe2 = spawnPipe(500, 42);
      expect(pipe1.topHeight).toBe(pipe2.topHeight);
    });
  });

  describe("checkCollision", () => {
    it("should return null when bird is safely between pipes", () => {
      const bird = { y: 300, velocity: 0 };
      const pipes = [{ id: 1, x: GAME_WIDTH / 2, topHeight: 200, passed: false }];
      expect(checkCollision(bird, pipes)).toBeNull();
    });

    it("should detect ground collision when bird is near bottom", () => {
      const bird = { y: GAME_HEIGHT - 25, velocity: 10 };
      expect(checkCollision(bird, [])).toBe("bird-ground");
    });

    it("should detect ceiling collision when bird is at top", () => {
      const bird = { y: 0, velocity: 0 };
      expect(checkCollision(bird, [])).toBe("bird-ceiling");
    });

    it("should detect pipe collision when bird overlaps top pipe", () => {
      const birdX = GAME_WIDTH / 4;
      const bird = { y: 150, velocity: 0 };
      const pipes = [
        { id: 1, x: birdX - BIRD_SIZE, topHeight: 200, passed: false },
      ];
      expect(checkCollision(bird, pipes)).toBe("bird-pipe");
    });

    it("should detect pipe collision when bird overlaps bottom pipe", () => {
      const birdX = GAME_WIDTH / 4;
      const bird = { y: PIPE_GAP + 250, velocity: 0 };
      const pipes = [
        { id: 1, x: birdX - BIRD_SIZE, topHeight: 200, passed: false },
      ];
      expect(checkCollision(bird, pipes)).toBe("bird-pipe");
    });

    it("should not detect collision when pipe is far away", () => {
      const bird = { y: 300, velocity: 0 };
      const pipes = [
        { id: 1, x: GAME_WIDTH * 2, topHeight: 200, passed: false },
      ];
      expect(checkCollision(bird, pipes)).toBeNull();
    });

    it("should not detect collision when bird is in the gap", () => {
      const bird = { y: 250, velocity: 0 };
      const pipes = [
        { id: 1, x: GAME_WIDTH / 4 - BIRD_SIZE, topHeight: 200, passed: false },
      ];
      // gap starts at 200 + PIPE_GAP = 360
      // bird is at 250, which should be above the bottom pipe at 360
      expect(checkCollision(bird, pipes)).toBeNull();
    });
  });

  describe("updateScore", () => {
    it("should return true when bird passes a pipe", () => {
      const pipe = { id: 1, x: 50, topHeight: 200, passed: false };
      expect(updateScore(pipe, 200)).toBe(true);
    });

    it("should return false if pipe has already been passed", () => {
      const pipe = { id: 1, x: 50, topHeight: 200, passed: true };
      expect(updateScore(pipe, 200)).toBe(false);
    });

    it("should return false when bird hasn't reached the pipe yet", () => {
      const pipe = { id: 1, x: 350, topHeight: 200, passed: false };
      expect(updateScore(pipe, 200)).toBe(false);
    });

    it("should not mutate the original pipe's passed status", () => {
      const pipe = { id: 1, x: 50, topHeight: 200, passed: false };
      updateScore(pipe, 200);
      expect(pipe.passed).toBe(false);
    });
  });

  describe("isPipeOffScreen", () => {
    it("should return true when pipe is completely off screen to the left", () => {
      const pipe = { id: 1, x: -200, topHeight: 200, passed: false };
      expect(isPipeOffScreen(pipe)).toBe(true);
    });

    it("should return false when pipe is on screen", () => {
      const pipe = { id: 1, x: 100, topHeight: 200, passed: false };
      expect(isPipeOffScreen(pipe)).toBe(false);
    });

    it("should return false when pipe is just entering the left edge", () => {
      const pipe = { id: 1, x: -50, topHeight: 200, passed: false };
      // PIPE_GAP/2 = 80, so -50 + 80 = 30 which is not < -50
      expect(isPipeOffScreen(pipe)).toBe(false);
    });
  });
});
