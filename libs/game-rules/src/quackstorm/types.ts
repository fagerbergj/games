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
  /** Geese this duckling may still pop without sinking (Big Mamas and angry survivors). */
  popsLeft: number;
  /** Damage dealt to the Keep when it lands: 1 for normal ducks, the opener's value for angry survivors, 10 for Big Mamas. */
  dmg: number;
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
   * Marks the gate the player chose at the opener. When the level sets
   * `survivorDmg`, a subtractive opener gate releases angry survivors with that
   * much Keep damage and one goose-pop (and their offspring inherit it), so the
   * wrong pick costs stars — not the level.
   */
  opener: boolean;
  /** Level-configured survivor damage for this gate's angry survivors (L5's −5). */
  survivorDmg?: number;
  /**
   * How many ducklings have crossed this gate since its toll last armed (at level
   * start and every TOLL_REARM_STEPS steps — not on every goose wave, so most
   * single shots at the fire rate pass through). The operation is taken as a toll
   * from this running flock, so a −10 gate eats the first ten ducklings (even lone
   * ones) of each arm and passes the rest one for one. For a +N egg the N lands on
   * the first crossing of each arm; later crossings pass one for one.
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
  /** Horizontal band [x0, x1] goose x-positions are drawn from. Default is the full river; L1 narrows it to the central lane so a still-aiming new player's fire reaches. */
  gooseX0: number;
  gooseX1: number;
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
 * Vertical spacing between geese inside one wave: 21 world units is 60 steps at
 * GOOSE_SPEED, so even the slowest single-shooter (one shot per FIRE_COOLDOWN)
 * can pop every goose in a wave as each one crosses their aim line. Without it,
 * three same-step geese are physically unpop-pable — the late player loses L4/L5
 * no matter how good their aim. Off-screen (y<0) members of a staggered wave
 * simply wait above the Keep, which is harmless.
 */
export const GOOSE_STAGGER = 21;
/**
 * Win-star thresholds as a share of the level's Keep HP: the bread earned per Keep
 * point is roughly constant, so a clean run lands near 1.0 and sloppy aim well below.
 */
export const STAR_RATIO = { one: 0.35, two: 0.7, three: 1.0 } as const;
/** Steps between toll re-arms: 15 s at the fixed 60 fps step. At the fire rate
 * (one shot per 0.5 s) an arm holds 30 shots, so a −10 gate eats about a third of
 * steady single-shot fire and passes the rest — it matters all level without
 * walling off lone ducklings the way per-wave re-arming did. */
export const TOLL_REARM_STEPS = 900;
export const BIG_MAMA_POP = 10;
export const BIG_MAMA_DAMAGE = 10;
export const MAX_BREAD = 100;
export const COLLIDE = 5;
/** How far a duckling may sit above the line and still count as crossing this step. */
export const CROSS_EPS = 0.001;
