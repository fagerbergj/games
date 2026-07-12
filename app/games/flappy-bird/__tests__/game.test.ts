import {
  createInitialState,
  step,
  jump,
  resetGame,
  checkCollision,
  hasPassedBird,
  generateFirstPipe,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BIRD_SIZE,
  GROUND_HEIGHT,
} from "../lib/game";
import { FlappyBirdState } from "../lib/types";

describe("Flappy Bird Game Logic", () => {
  describe("createInitialState", () => {
    it("should return ready phase", () => {
      const state = createInitialState();
      expect(state.phase).toBe("ready");
    });

    it("should start with empty pipes", () => {
      const state = createInitialState();
      expect(state.pipes).toEqual([]);
    });

    it("should start with score 0", () => {
      const state = createInitialState();
      expect(state.score).toBe(0);
    });

    it("should position bird in the middle vertically", () => {
      const state = createInitialState();
      expect(state.bird.y).toBe(CANVAS_HEIGHT / 2 - BIRD_SIZE / 2);
    });
  });

  describe("step", () => {
    let state: FlappyBirdState;

    beforeEach(() => {
      state = createInitialState();
      state.phase = "playing";
      // Add a pipe for collision testing
      const firstPipe = generateFirstPipe();
      state.pipes = [firstPipe];
    });

    it("should apply gravity to bird velocity each frame", () => {
      const afterStep = step(state);
      expect(afterStep.bird.velocity).toBeGreaterThan(state.bird.velocity);
    });

    it("should keep same state when phase is gameover", () => {
      const gameOverState = { ...state, phase: "gameover" as const };
      const afterStep = step(gameOverState);
      expect(afterStep.phase).toBe("gameover");
      expect(afterStep.bird.y).toBe(gameOverState.bird.y);
    });

    it("should keep same state when phase is ready", () => {
      const readyState = createInitialState();
      const afterStep = step(readyState);
      expect(afterStep.phase).toBe("ready");
      expect(afterStep.score).toBe(0);
    });
  });

  describe("jump", () => {
    it("should change velocity to negative (upward)", () => {
      const state = createInitialState();
      state.phase = "playing";
      const afterJump = jump(state);
      expect(afterJump.bird.velocity).toBeLessThan(0);
    });

    it("should switch phase from ready to playing and step", () => {
      const state = createInitialState();
      const afterJump = jump(state);
      expect(afterJump.phase).toBe("playing");
    });

    it("should not change anything when gameover", () => {
      const state = createInitialState();
      state.phase = "gameover";
      const initialBirdY = state.bird.y;
      const afterJump = jump(state);
      expect(afterJump.phase).toBe("gameover");
      expect(afterJump.bird.y).toBe(initialBirdY);
    });
  });

  describe("checkCollision", () => {
     it("should not detect ground collision when bird is above ground", () => {
      const birdY = 200; // clearly above ground
      const collision = checkCollision(birdY, CANVAS_WIDTH / 3, []);
      expect(collision.hitGround).toBe(false);
    });

    it("should detect ground collision when bird hits the bottom", () => {
      const birdY = CANVAS_HEIGHT - GROUND_HEIGHT + 10; // below ground line
      const collision = checkCollision(birdY, CANVAS_WIDTH / 3, []);
      expect(collision.hitGround).toBe(true);
    });

    it("should detect ceiling collision", () => {
      const birdY = -10; // above ceiling
      const collision = checkCollision(birdY, CANVAS_WIDTH / 3, []);
      expect(collision.hitGround).toBe(true); // ceiling counts as game-over boundary
    });

    it("should not detect collision when bird is in gap", () => {
      const pipes = [
        { id: 1, x: CANVAS_WIDTH / 2, gapY: CANVAS_HEIGHT / 2 },
      ];
      const birdX = CANVAS_WIDTH / 2; // center of pipe x-range
      const birdY = CANVAS_HEIGHT / 2; // center of gap
      const collision = checkCollision(birdY, birdX, pipes);
      expect(collision.hitPipe).toBe(false);
    });

    it("should detect pipe collision when bird is not in gap", () => {
      const pipes = [
        { id: 1, x: CANVAS_WIDTH / 2, gapY: CANVAS_HEIGHT / 2 },
      ];
      const birdX = CANVAS_WIDTH / 2; // center of pipe x-range (aligned)
      const birdY = 50; // above the gap — will hit top pipe
      const collision = checkCollision(birdY, birdX, pipes);
      expect(collision.hitPipe).toBe(true);
    });
  });

  describe("hasPassedBird", () => {
    it("should return true when pipe has moved past bird position", () => {
      const result = hasPassedBird(100, CANVAS_WIDTH / 3 + 50);
      expect(result).toBe(true);
    });

    it("should return false when pipe hasn't reached bird yet", () => {
      const result = hasPassedBird(CANVAS_WIDTH / 3 + 200, CANVAS_WIDTH / 3 + 50);
      expect(result).toBe(false);
    });
  });

  describe("resetGame", () => {
    it("should reset to ready phase", () => {
      const state = createInitialState();
      const afterReset = resetGame({ ...state, score: 5, phase: "gameover" as const });
      expect(afterReset.phase).toBe("ready");
      expect(afterReset.score).toBe(0);
      expect(afterReset.pipes).toEqual([]);
    });

    it("should preserve highScore from previous game", () => {
      const state = createInitialState();
      state.highScore = 15;
      const afterReset = resetGame(state);
      expect(afterReset.highScore).toBe(15);
    });
  });
});
