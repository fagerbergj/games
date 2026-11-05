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
   * Set on the final level only: the −5 toll there releases angry survivors that
   * keep paddling with this much Keep damage and one goose-pop (and their
   * offspring inherit it). Without it the toll stack starves a 30-shot arm and the
   * level stalls; with it the wrong opener costs stars, not the level. L1–L4 leave
   * it unset: their subtractive openers stay plain and stay slower.
   */
  survivorDmg?: number;
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
     * L1 narrows it to the central lane so a new player who never moves their aim
     * still reaches them.
     */
    x0?: number;
    x1?: number;
  };
}

const mul = (value: number): GateOp => ({ kind: "mul", value });
const sub = (value: number): GateOp => ({ kind: "sub", value });
const div = (value: number): GateOp => ({ kind: "div", value });

/**
 * Tuning notes: the opener gates are small on purpose (×3–×5 against −2–−5) so the
 * choice costs something, and at higher levels the wrong pick gets punishing — on L5
 * it roughly halves even a perfect player's win rate, but on L1–L4 the upper gates,
 * the geese and the Big Mama still decide it. The first gate is narrow and drifts like
 * the rest, so the player has to aim it — except L1's, which is static: the one gate
 * a still-aiming new player can rely on, with geese marching down the central lane so
 * even a held fire at the middle reaches them. Toll gates re-arm on a fixed timer
 * (TOLL_REARM_STEPS, see step), so a −10 keeps mattering all level without walling off
 * single shots. L1's first wave is late on purpose (firstWaveAt: 600 — ten seconds in):
 * a new player should get to watch the gates work before a goose decides for them.
 * Difficulty rises L1→L5 in Keep HP, total geese and — measured by the perfect-aim
 * and weak bots in the difficulty tests — time to clear and loss rate; see the tests.
 */
export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    keepHp: 100,
    narrator: "One shot to riches, or a very sad pond. Choose, hero.",
    choice: [
      { label: "×3", op: mul(3) },
      { label: "−2", op: sub(2) },
    ],
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
      { label: "−3", op: sub(3) },
    ],
    firstGate: { x: 50, y: 78, span: 11, drift: 0.15 },
    upperGates: [
      { x: 35, y: 58, span: 15, drift: 0.14, op: mul(2) },
      { x: 65, y: 44, span: 15, drift: -0.14, op: sub(10) },
      { x: 45, y: 26, span: 15, drift: 0.14, op: div(2) },
    ],
    goose: { waveSize: 1, waveInterval: 140, maxWaves: 18 },
  },
  {
    id: 3,
    keepHp: 200,
    narrator: "Somewhere a goose is already filing a complaint.",
    choice: [
      { label: "×5", op: mul(5) },
      { label: "−3", op: sub(3) },
    ],
    firstGate: { x: 50, y: 78, span: 10.5, drift: 0.16 },
    upperGates: [
      { x: 30, y: 62, span: 15, drift: 0.16, op: sub(10) },
      { x: 70, y: 50, span: 15, drift: -0.16, op: null },
      { x: 45, y: 38, span: 15, drift: 0.16, op: div(2) },
      { x: 55, y: 24, span: 15, drift: -0.16, op: mul(2) },
    ],
    goose: { waveSize: 1, waveInterval: 120, maxWaves: 24 },
  },
  {
    id: 4,
    keepHp: 380,
    narrator: "Double the gates, double the regret. You're doing fine.",
    choice: [
      { label: "×4", op: mul(4) },
      { label: "−4", op: sub(4) },
    ],
    firstGate: { x: 50, y: 78, span: 10, drift: 0.17 },
    upperGates: [
      { x: 30, y: 64, span: 14, drift: 0.18, op: mul(2) },
      { x: 70, y: 54, span: 14, drift: -0.18, op: sub(10) },
      { x: 40, y: 42, span: 14, drift: 0.18, op: null },
      { x: 60, y: 30, span: 14, drift: -0.18, op: div(2) },
      { x: 50, y: 24, span: 14, drift: 0.18, op: sub(10) },
    ],
    goose: { waveSize: 2, waveInterval: 120, maxWaves: 24 },
  },
  {
    id: 5,
    keepHp: 440,
    survivorDmg: 5,
    narrator: "Final gate. The Big Mama is listening. Make it count.",
    choice: [
      { label: "×3", op: mul(3) },
      { label: "−5", op: sub(5) },
    ],
    firstGate: { x: 50, y: 78, span: 10, drift: 0.18 },
    // Exactly two −10 tolls in the whole river (opener −5 + these): a full arm of 30
    // shots keeps most of itself, so the subtractive opener costs stars instead of
    // stalling the level. No mystery egg: the final level's tolls are knowable.
    upperGates: [
      { x: 30, y: 66, span: 14, drift: 0.2, op: sub(10) },
      { x: 70, y: 58, span: 14, drift: -0.2, op: div(2) },
      { x: 40, y: 48, span: 14, drift: 0.2, op: mul(2) },
      { x: 60, y: 38, span: 14, drift: -0.2, op: mul(2) },
      { x: 50, y: 28, span: 14, drift: 0.2, op: div(2) },
      { x: 45, y: 24, span: 14, drift: -0.2, op: div(2) },
    ],
    goose: { waveSize: 2, waveInterval: 170, maxWaves: 25 },
  },
];

export const levelCount = LEVELS.length;

export function levelConfig(id: number): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id);
}
