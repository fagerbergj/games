/**
 * Quackstorm rules: pure functions over plain-JSON state. Every transition is a fixed
 * step driven by a seeded RNG, so a level replays identically. No React, no DOM.
 */

/** The four operations a lily-pad gate can carry. */
export type OpKind = "add" | "sub" | "mul" | "div";

export interface GateOp {
  kind: OpKind;
  value: number;
}

/** A duckling paddling upstream. `big` marks a Big Mama (pushes through geese). */
export interface Duckling {
  id: number;
  x: number;
  y: number;
  big: boolean;
  /** Geese a Big Mama may still pop before it gives up. */
  popsLeft: number;
}

/** A goose marching down from the Keep. */
export interface Goose {
  id: number;
  x: number;
  y: number;
}

/** A drifting lily-pad gate. `op` is null until a mystery egg is revealed. */
export interface Gate {
  id: number;
  x: number;
  y: number;
  /** Half-width of the gate's trigger zone, in world units. */
  span: number;
  /** Horizontal drift per step, in world units (sign is the direction). */
  drift: number;
  op: GateOp | null;
  revealed: boolean;
  /**
   * How many ducklings have crossed this gate so far this level. The operation is
   * taken as a toll from this running flock, so a −10 gate eats the first ten
   * ducklings (even lone ones) and passes the rest one for one. For a +N egg the
   * N lands on the first crossing and later crossings pass one for one.
   */
  flock: number;
}

/** The two-gate fake-ad opener. */
export interface ChoiceGate {
  label: string;
  op: GateOp;
}

export type Phase = "choice" | "playing" | "won" | "lost";

export interface QuackstormState {
  seed: number;
  level: number;
  phase: Phase;
  keepHp: number;
  keepMaxHp: number;
  /** Bread meter, 0..MAX_BREAD. A full meter makes the next shot a Big Mama. */
  bread: number;
  cannonX: number;
  holding: boolean;
  fireCooldown: number;
  stepCount: number;
  ducklings: Duckling[];
  geese: Goose[];
  gates: Gate[];
  nextId: number;
  nextWaveAt: number;
  waveNumber: number;
  maxWaves: number;
  waveSize: number;
  waveInterval: number;
  choice: ChoiceGate[];
  narrator: string;
  stars: number;
  /** Total bread earned on this level — what the win stars are judged by. */
  breadEarned: number;
  /** Internal mulberry32 state for goose positions (order of spawning only). */
  rng: number;
}

/** A normalized 100x100 world: y=0 is the Keep, y=100 is the cannon. */
export const WORLD = {
  width: 100,
  height: 100,
  keepY: 6,
  cannonY: 94,
} as const;

export const DUCK_SPEED = 0.75;
export const GOOSE_SPEED = 0.35;
/** Steps between shots. One shot per 0.5 s at the fixed 60 fps step. */
export const FIRE_COOLDOWN = 30;
/**
 * Win-star thresholds as a share of the level's Keep HP: the bread earned per Keep
 * point is roughly constant, so a clean run lands near 1.0 and sloppy aim well below.
 */
export const STAR_RATIO = { one: 0.35, two: 0.7, three: 1.0 } as const;
export const BIG_MAMA_POP = 10;
export const BIG_MAMA_DAMAGE = 10;
export const MAX_BREAD = 100;
export const COLLIDE = 5;
/** How far a duckling may sit above the line and still count as crossing this step. */
export const CROSS_EPS = 0.001;
