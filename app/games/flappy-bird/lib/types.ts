export interface Bird {
  y: number;
  velocity: number;
}

export interface Pipe {
  x: number;
  gapTop: number;
  scored: boolean;
}

export type GameState = "start" | "playing" | "gameover";

export interface FlappyBirdState {
  bird: Bird;
  pipes: Pipe[];
  score: number;
  gameState: GameState;
  highScore: number;
  groundY: number;
}
