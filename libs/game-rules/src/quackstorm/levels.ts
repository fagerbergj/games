import type { GateOp } from "./types";

export interface GateSpec {
  x: number;
  y: number;
  span: number;
  drift: number;
  /** null = a mystery egg (`?`). */
  op: GateOp | null;
}

export interface LevelConfig {
  id: number;
  keepHp: number;
  narrator: string;
  /** The two fake-ad gates the player picks between at the opener. */
  choice: { label: string; op: GateOp }[];
  /**
   * Clear-time star thresholds, in fixed steps: three stars for a clear in ≤ three,
   * two for ≤ two, one for winning at all. Time is what play buys — a player who
   * aims the gates and pops the geese clears before a sloppy one.
   */
  starTimes: { three: number; two: number };
  /** Where the chosen gate lands: the first gate a duckling meets (near the cannon). */
  firstGate: Omit<GateSpec, "op">;
  /** The rest of the river, above the first gate. */
  upperGates: GateSpec[];
  goose: {
    waveSize: number;
    waveInterval: number;
    maxWaves: number;
    /**
     * Step at which the first wave spawns. Defaults to `waveInterval`; a longer
     * value lets a new player watch the gates work before a goose decides for them.
     */
    firstWaveAt?: number;
    /**
     * Where the geese in a wave march from (x range). Defaults to the full river;
     * L1–L2 narrow it to the central lane so a new player who never moves their
     * aim still reaches them, and it widens as the levels get hard.
     */
    x0?: number;
    x1?: number;
    /**
     * Vertical spacing between geese in one wave, in world units. Defaults to
     * GOOSE_STAGGER; later levels widen it so a drag-aiming player can pop every
     * member of a multi-goose wave.
     */
    stagger?: number;
  };
}

const mul = (value: number): GateOp => ({ kind: "mul", value });
const sub = (value: number): GateOp => ({ kind: "sub", value });
const div = (value: number): GateOp => ({ kind: "div", value });

/**
 * Tuning notes. The opener gates stay small (×3–×5 against −3–−5) and every
 * subtractive opener releases angry survivors that carry the toll as their Keep
 * damage — so the wrong pick costs stars and a little time on every level
 * (measured in the difficulty tests: the − opener clears in under 1.5× the ×
 * opener on L1–L4 and about the same on L5) instead of the upper tolls starving
 * the stream and settling the level. The first gate is narrow and drifts like the
 * rest, so the player has to aim it — except L1's, which is static. The goose lane
 * starts as the central lane L1–L2 (a still-aiming new player's held fire still
 * reaches every goose) and widens L3→L5, while L4–L5 stagger their two-goose
 * waves so a drag-aiming player can pop each member as it crosses their aim line.
 * Toll gates re-arm on a fixed timer (TOLL_REARM_STEPS, see step), so a −10 keeps
 * mattering all level without walling off single shots, and mystery eggs never
 * carry a toll (rng) so a − player's thin stream is not taxed twice. L1's first
 * wave is late on purpose (firstWaveAt: 600 — ten seconds in). Difficulty rises
 * L1→L5 in Keep HP, total geese, lane width, wave size and — measured by the
 * perfect-aim, weak, late-reactor and goose-only bots in the difficulty tests —
 * time to clear and win rate; see the tests.
 */
export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    keepHp: 100,
    narrator: "One shot to riches, or a very sad pond. Choose, hero.",
    choice: [
      { label: "×3", op: mul(3) },
      { label: "−3", op: sub(3) },
    ],
    starTimes: { three: 820, two: 1500 },
    firstGate: { x: 50, y: 78, span: 11, drift: 0 },
    upperGates: [
      { x: 40, y: 55, span: 16, drift: 0.12, op: null },
      { x: 60, y: 32, span: 16, drift: -0.12, op: mul(2) },
    ],
    goose: { waveSize: 1, waveInterval: 240, maxWaves: 14, firstWaveAt: 600, x0: 46, x1: 54 },
  },
  {
    id: 2,
    keepHp: 180,
    narrator: "The geese heard about the bread. They brought friends.",
    choice: [
      { label: "×4", op: mul(4) },
      { label: "−4", op: sub(4) },
    ],
    starTimes: { three: 1300, two: 2000 },
    firstGate: { x: 50, y: 78, span: 11, drift: 0.15 },
    upperGates: [
      { x: 35, y: 58, span: 15, drift: 0.14, op: mul(2) },
      { x: 65, y: 44, span: 15, drift: -0.14, op: mul(2) },
      { x: 45, y: 26, span: 15, drift: 0.14, op: div(2) },
    ],
    // Same central lane as L1: level two teaches aiming the drifting gate, not
    // aiming the geese — a still-aiming player must still reach every goose.
    // Upper gates are × and ÷ only: ratio gates scale both opener streams the
    // same, so the − pick stays a small constant cost instead of a toll stack.
    goose: { waveSize: 1, waveInterval: 140, maxWaves: 18, x0: 46, x1: 54 },
  },
  {
    id: 3,
    keepHp: 320,
    narrator: "Somewhere a goose is already filing a complaint.",
    choice: [
      { label: "×5", op: mul(5) },
      { label: "−4", op: sub(4) },
    ],
    starTimes: { three: 1270, two: 1600 },
    firstGate: { x: 50, y: 78, span: 10.5, drift: 0.16 },
    upperGates: [
      { x: 30, y: 62, span: 15, drift: 0.16, op: mul(2) },
      { x: 70, y: 50, span: 15, drift: -0.16, op: null },
      { x: 45, y: 38, span: 15, drift: 0.16, op: div(2) },
      { x: 55, y: 24, span: 15, drift: -0.16, op: mul(2) },
    ],
    goose: { waveSize: 1, waveInterval: 120, maxWaves: 24, x0: 40, x1: 60 },
  },
  {
    id: 4,
    keepHp: 380,
    narrator: "Double the gates, double the regret. You're doing fine.",
    choice: [
      { label: "×4", op: mul(4) },
      { label: "−4", op: sub(4) },
    ],
    starTimes: { three: 1450, two: 1550 },
    firstGate: { x: 50, y: 78, span: 10, drift: 0.17 },
    upperGates: [
      { x: 30, y: 64, span: 14, drift: 0.18, op: mul(2) },
      { x: 55, y: 50, span: 14, drift: -0.18, op: null },
      { x: 70, y: 36, span: 14, drift: 0.18, op: div(2) },
      { x: 45, y: 22, span: 14, drift: -0.18, op: mul(2) },
    ],
    goose: { waveSize: 2, waveInterval: 160, maxWaves: 24, x0: 30, x1: 70, stagger: 36 },
  },
  {
    id: 5,
    keepHp: 440,
    narrator: "Final gate. The Big Mama is listening. Make it count.",
    choice: [
      { label: "×3", op: mul(3) },
      { label: "−5", op: sub(5) },
    ],
    starTimes: { three: 6600, two: 8400 },
    firstGate: { x: 50, y: 78, span: 10, drift: 0.18 },
    // One −10 toll above the opener (the −5 survivor's anger carries the stream
    // through it), and no mystery egg: the final level's tolls are knowable.
    upperGates: [
      { x: 30, y: 66, span: 14, drift: 0.2, op: sub(10) },
      { x: 70, y: 58, span: 14, drift: -0.2, op: div(2) },
      { x: 40, y: 48, span: 14, drift: 0.2, op: mul(2) },
      { x: 60, y: 38, span: 14, drift: -0.2, op: mul(2) },
      { x: 50, y: 28, span: 14, drift: 0.2, op: div(2) },
      { x: 45, y: 24, span: 14, drift: -0.2, op: div(2) },
    ],
    goose: { waveSize: 2, waveInterval: 220, maxWaves: 25, x0: 26, x1: 74, stagger: 42 },
  },
];

export const levelCount = LEVELS.length;

export function levelConfig(id: number): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id);
}
