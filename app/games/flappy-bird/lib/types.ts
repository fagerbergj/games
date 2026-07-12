export interface Bird {
  x: number;
  y: number;
  velocity: number;
}

export interface Pipe {
  id: string;
  x: number;
  gapY: number;
  gapHeight: number;
  scored: boolean;
}

export type GamePhase = "setup" | "playing" | "gameover";

export interface FlappyBirdState {
  phase: GamePhase;
  bird: Bird;
  pipes: Pipe[];
  score: number;
  highScore: number;
  groundX: number;
}
