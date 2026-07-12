export type GamePhase = "ready" | "playing" | "gameover";

export interface BirdState {
  y: number;
  velocity: number;
}

export interface PipeData {
  id: number;
  x: number;
  gapY: number;
}

export interface FlappyBirdState {
  phase: GamePhase;
  bird: BirdState;
  pipes: PipeData[];
  score: number;
  highScore: number;
  frameCount: number;
}
