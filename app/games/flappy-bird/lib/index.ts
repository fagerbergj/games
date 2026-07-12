export {
  DEFAULT_GRAVITY,
  DEFAULT_FLAP_STRENGTH,
  DEFAULT_PIPE_SPEED,
  DEFAULT_PIPE_GAP_HEIGHT,
  DEFAULT_PIPE_WIDTH,
  DEFAULT_BIRD_SIZE,
  DEFAULT_GROUND_HEIGHT,
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
} from "./game-logic";

export type { Bird, Pipe, GamePhase, FlappyBirdState } from "./types";
