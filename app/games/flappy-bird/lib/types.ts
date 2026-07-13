export type GamePhase = "ready" | "playing" | "gameover";

export interface Bird {
  id: string;
  x: number;
  y: number;
  velocity: number;
  width: number;
  height: number;
}

export interface Pipe {
  id: string;
  x: number;
  topHeight: number;
  bottomY: number;
  width: number;
  passed: boolean;
}

export interface GameState {
  phase: GamePhase;
  score: number;
  bird: Bird;
  pipes: Pipe[];
  frameCount: number;
  canvasWidth: number;
  canvasHeight: number;
  highScore: number;
}
