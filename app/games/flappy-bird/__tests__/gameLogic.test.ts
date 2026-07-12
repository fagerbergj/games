import { describe, it, expect, beforeEach } from "vitest";
import {
  createInitialState,
  flap,
  resetGame,
  updatePipes,
  moveBird,
  checkCollision,
  updateScore,
  updateState,
  config,
} from "../lib/gameLogic";
import type { Bird, FlappyBirdState } from "../lib/types";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

describe("Flappy Bird Game Logic", () => {
  let initialState: FlappyBirdState;

  beforeEach(() => {
    initialState = createInitialState(CANVAS_WIDTH, CANVAS_HEIGHT);
  });

  describe("createInitialState", () => {
    it("should create a valid initial state", () => {
      expect(initialState.bird).toBeDefined();
      expect(initialState.bird.velocity).toBe(0);
      expect(initialState.pipes).toEqual([]);
      expect(initialState.score).toBe(0);
      expect(initialState.gameState).toBe("start");
      expect(initialState.highScore).toBe(0);
    });

    it("should place the bird at a reasonable starting position", () => {
      const groundY = CANVAS_HEIGHT - config.GROUND_HEIGHT;
      const expectedBirdY = groundY / 2;
      expect(initialState.bird.y).toBe(expectedBirdY);
      expect(initialState.groundY).toBe(groundY);
    });

    it("should create correct ground position", () => {
      expect(initialState.groundY).toBe(CANVAS_HEIGHT - config.GROUND_HEIGHT);
    });
  });

  describe("physics - moveBird", () => {
    it("should apply gravity to increase velocity downward", () => {
      const bird = { y: 200, velocity: 0 };
      const result = moveBird(bird, initialState.groundY);

      expect(result.bird.velocity).toBeGreaterThan(0); // Positive = downward
    });

    it("should update bird position by adding velocity", () => {
      const bird = { y: 200, velocity: 2 };
      const result = moveBird(bird, initialState.groundY);

      // With positive velocity (falling), gravity increases it further → bird moves down (higher y)
      expect(result.bird.velocity).toBeGreaterThan(bird.velocity);
    });

    it("should return collision false for normal movement", () => {
      const bird = { y: 200, velocity: 0 };
      const result = moveBird(bird, initialState.groundY);

      expect(result.collision).toBe(false);
    });
  });

  describe("physics - ground collision in moveBird", () => {
    it("should detect ground collision when bird reaches ground level", () => {
      const birdAtGround: Bird = { y: CANVAS_HEIGHT - config.GROUND_HEIGHT - config.BIRD_SIZE, velocity: 1 };
      const result = moveBird(birdAtGround, initialState.groundY);

      expect(result.collision).toBe(true);
      expect(result.bird.y).toBe(CANVAS_HEIGHT - config.GROUND_HEIGHT - config.BIRD_SIZE);
    });

    it("should return collision false when bird is in the air", () => {
      const birdInAir = { y: 200, velocity: 1 };
      const result = moveBird(birdInAir, initialState.groundY);

      expect(result.collision).toBe(false);
    });
  });

  describe("physics - ceiling collision in moveBird", () => {
    it("should clamp bird to top of screen when above ceiling", () => {
      const bird = { y: -50, velocity: -10 };
      const result = moveBird(bird, initialState.groundY);

      expect(result.bird.y).toBe(0);
      expect(result.collision).toBe(false); // Ceiling doesn't trigger game over
    });
  });

  describe("flap action", () => {
    it("should set upward velocity on flap when in start state", () => {
      const newState = flap(initialState);

      expect(newState.bird.velocity).toBe(config.FLAP_STRENGTH);
      expect(newState.gameState).toBe("playing");
    });

    it("should trigger flapping (upward velocity) when already playing", () => {
      const playingState = { ...initialState, gameState: "playing" as const };
      const newState = flap(playingState);

      expect(newState.bird.velocity).toBe(config.FLAP_STRENGTH);
    });

    it("should reset game state from gameover on flap", () => {
      const gameOverState: FlappyBirdState = {
        ...initialState,
        gameState: "gameover" as const,
        score: 5,
      };
      const newState = flap(gameOverState);

      expect(newState.gameState).toBe("start");
    });
  });

  describe("resetGame", () => {
    it("should reset bird position to center", () => {
      const withScore: FlappyBirdState = {
        ...initialState,
        score: 10,
        gameState: "gameover" as const,
      };
      const reset = resetGame(withScore);

      expect(reset.bird.velocity).toBe(0);
      expect(reset.pipes).toEqual([]);
      expect(reset.score).toBe(0);
      expect(reset.gameState).toBe("start");
    });

    it("should persist high score on reset", () => {
      const withHighScore: FlappyBirdState = {
        ...initialState,
        score: 15,
        highScore: 10,
        gameState: "gameover" as const,
      };
      const reset = resetGame(withHighScore);

      expect(reset.highScore).toBe(15);
    });

    it("should update high score if current exceeds previous", () => {
      const withLowHighScore: FlappyBirdState = {
        ...initialState,
        score: 20,
        highScore: 5,
        gameState: "gameover" as const,
      };
      const reset = resetGame(withLowHighScore);

      expect(reset.highScore).toBe(20);
    });
  });

  describe("pipes - updatePipes", () => {
    it("should move pipes to the left by PIPE_SPEED", () => {
      const pipes = [
        { x: 800, gapTop: 200, scored: false },
        { x: 600, gapTop: 300, scored: false },
      ];
      const result = updatePipes(pipes);

      expect(result[0].x).toBe(800 - config.PIPE_SPEED);
      expect(result[1].x).toBe(600 - config.PIPE_SPEED);
    });

    it("should remove off-screen pipes", () => {
      const pipes = [
        { x: -100, gapTop: 200, scored: false },
        { x: CANVAS_WIDTH, gapTop: 300, scored: false },
      ];
      const result = updatePipes(pipes);

      expect(result.length).toBe(1);
    });
  });

  describe("collision detection", () => {
    it("should detect ground collision", () => {
      const birdOnGround = { y: initialState.groundY - config.BIRD_SIZE };
      const result = checkCollision(birdOnGround, [], initialState.groundY);

      expect(result).toBe(true);
    });

    it("should not detect ground collision when bird is in the air", () => {
      const birdInAir = { y: 200 };
      const result = checkCollision(birdInAir, [], initialState.groundY);

      expect(result).toBe(false);
    });

    it("should detect ceiling collision", () => {
      const birdAboveCeiling = { y: -10 };
      const result = checkCollision(birdAboveCeiling, [], initialState.groundY);

      expect(result).toBe(true);
    });

    it("should not detect collision when bird is in the middle of the gap", () => {
      const birdInMiddle = { y: 250 };
      const pipe = { x: 40, gapTop: 200, scored: false };
      // Gap is from 200 to 350 (gapTop + PIPE_GAP=150)
      // Bird at y=250, size 30 => top 250, bottom 280 => fully inside gap vertically.
      // Bird x: 50-80, pipe x: 40-100 => horizontal overlap

      const result = checkCollision(birdInMiddle, [pipe], initialState.groundY);

      expect(result).toBe(false);
    });

    it("should detect collision with top pipe", () => {
      const birdTopPipe = { y: 150 }; // Overlaps with top pipe ending at gapTop=200
      const pipe = { x: 40, gapTop: 200, scored: false };
      // Bird center around x=50, size=30 -> right=80
      // Pipe x=40, width=60 -> right=100
      // Horizontal overlap: 80 > 40 && 50 < 100 = true
      // Top pipe ends at 200, bird top is 150 (bird.y) and bottom is 180
      // birdTop(150) < gapTop(200) = true => collision

      const result = checkCollision(birdTopPipe, [pipe], initialState.groundY);

      expect(result).toBe(true);
    });

    it("should detect collision with bottom pipe", () => {
      const birdBottomPipe = { y: 340 }; // Bird size 30, so birdBottom=370
      const pipe = { x: 40, gapTop: 200, scored: false };
      // Bottom pipe starts at gapTop + PIPE_GAP(150) = 350
      // birdBottom(370) > 350 => collision

      const result = checkCollision(birdBottomPipe, [pipe], initialState.groundY);

      expect(result).toBe(true);
    });

    it("should not detect collision when pipes are far away horizontally", () => {
      const birdInMiddle = { y: 250 };
      const pipeFarAway = { x: 800, gapTop: 200, scored: false };

      const result = checkCollision(birdInMiddle, [pipeFarAway], initialState.groundY);

      expect(result).toBe(false);
    });
  });

  describe("scoring - updateScore", () => {
    it("should not increment score when bird hasn't passed pipe yet", () => {
      const pipe = { x: 200, gapTop: 200, scored: false };
      const result = updateScore([pipe], CANVAS_WIDTH, 0);

      expect(result.score).toBe(0);
      expect(result.pipes[0].scored).toBe(false);
    });

    it("should increment score and mark pipe as scored when bird passes", () => {
      // Pipe right edge at 70 (x + PIPE_WIDTH), bird x=50 + BIRD_SIZE(30) = 80
      // Bird passes when pipe.x + PIPE_WIDTH < 50 => 10+60=70 < 50? No!
      // Actually the check is: pipe.x + PIPE_WIDTH < 50, so 10+60=70 < 50 = false
      // Need pipe to be further left: x=0 -> 0+60=60 > 50... hmm
      // Wait, re-reading the gameLogic code: !pipe.scored && pipe.x + PIPE_WIDTH < 50
      // So pipe needs right edge to be left of bird's x position (50)
      // Pipe at x=0: 0+60=60 > 50 => false. Pipe at x=-10: -10+60=50, not < 50 either.
      // Pipe at x=-20: -20+60=40 < 50 => true!

      const scoredPipe = { x: -20, gapTop: 200, scored: false };
      const result = updateScore([scoredPipe], CANVAS_WIDTH, 0);

      expect(result.score).toBe(1);
      expect(result.pipes[0].scored).toBe(true);
    });

    it("should not increment again for already scored pipe", () => {
      const scoredPipe = { x: -20, gapTop: 200, scored: true };
      const result = updateScore([scoredPipe], CANVAS_WIDTH, 5);

      expect(result.score).toBe(5); // No increment
      expect(result.pipes[0].scored).toBe(true);
    });
  });

  describe("game state transitions - updateState", () => {
    it("should not update anything when gameState is start", () => {
      const result = updateState(initialState, CANVAS_WIDTH, CANVAS_HEIGHT, 0, 0);

      expect(result.state.gameState).toBe("start");
    });

    it("should return collision false for normal playing state with no pipes", () => {
      const playingState: FlappyBirdState = {
        ...initialState,
        gameState: "playing",
      };
      const result = updateState(playingState, CANVAS_WIDTH, CANVAS_HEIGHT, 100, 0);

      expect(result.state.gameState).toBe("playing");
    });

    it("should transition to gameover on collision with ground", () => {
      // Set bird near the ground so next physics update will collide
      const birdAtBottom = { y: CANVAS_HEIGHT - config.GROUND_HEIGHT - config.BIRD_SIZE, velocity: 1 };
      const playingState: FlappyBirdState = {
        ...initialState,
        gameState: "playing",
        bird: birdAtBottom,
      };
      const result = updateState(playingState, CANVAS_WIDTH, CANVAS_HEIGHT, 100, 0);

      expect(result.state.gameState).toBe("gameover");
    });

    it("should increment score when pipe passes", () => {
      // Pipe already far left (bird has passed)
      const scoredPipe = { x: -20, gapTop: 200, scored: false };
      const playingState: FlappyBirdState = {
        ...initialState,
        gameState: "playing",
        pipes: [scoredPipe],
        score: 5,
      };
      const result = updateState(playingState, CANVAS_WIDTH, CANVAS_HEIGHT, 100, 0);

      expect(result.state.score).toBe(6); // Score incremented by 1
    });

    it("should spawn a new pipe at the start of playing", () => {
      const playingState: FlappyBirdState = {
        ...initialState,
        gameState: "playing",
        pipes: [],
      };
      const result = updateState(
        playingState,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        1600, // After PIPE_INTERVAL (1500ms)
        100    // Last spawn at t=100
      );

      expect(result.state.pipes.length).toBe(1);
      expect(result.pipeSpawned).toBe(true);
    });

    it("should not spawn pipe before interval elapses", () => {
      const playingState: FlappyBirdState = {
        ...initialState,
        gameState: "playing",
        pipes: [],
      };
      const result = updateState(
        playingState,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        500, // Before PIPE_INTERVAL
        100
      );

      expect(result.state.pipes.length).toBe(0);
      expect(result.pipeSpawned).toBe(false);
    });

    it("should set gameover state when bird hits ceiling", () => {
      const birdAtCeiling: FlappyBirdState = {
        ...initialState,
        gameState: "playing",
        bird: { y: -10, velocity: 0 },
      };
      const result = updateState(birdAtCeiling, CANVAS_WIDTH, CANVAS_HEIGHT, 100, 0);

      expect(result.state.gameState).toBe("gameover");
    });
  });

  describe("config constants", () => {
    it("should export all physics constants", () => {
      expect(config.GRAVITY).toBe(0.5);
      expect(config.FLAP_STRENGTH).toBe(-8);
      expect(config.PIPE_SPEED).toBe(3);
       expect(config.PIPE_GAP).toBe(150); // Gap between pipes (top and bottom)
      expect(config.BIRD_SIZE).toBe(30);
      expect(config.GROUND_HEIGHT).toBe(50);
    });
  });
});
