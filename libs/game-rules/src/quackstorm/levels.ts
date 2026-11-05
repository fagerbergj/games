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
  /** Where the chosen gate lands: the first gate a duckling meets (near the cannon). */
  firstGate: Omit<GateSpec, "op">;
  /** The rest of the river, above the first gate. */
  upperGates: GateSpec[];
  goose: { waveSize: number; waveInterval: number; maxWaves: number };
}

const mul = (value: number): GateOp => ({ kind: "mul", value });
const sub = (value: number): GateOp => ({ kind: "sub", value });
const div = (value: number): GateOp => ({ kind: "div", value });

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    keepHp: 50,
    narrator: "One shot to riches, or a very sad pond. Choose, hero.",
    choice: [
      { label: "×100", op: mul(100) },
      { label: "−1", op: sub(1) },
    ],
    firstGate: { x: 50, y: 78, span: 30, drift: 0 },
    upperGates: [
      { x: 40, y: 55, span: 22, drift: 0.12, op: mul(2) },
      { x: 60, y: 32, span: 22, drift: -0.12, op: null },
    ],
    goose: { waveSize: 2, waveInterval: 240, maxWaves: 4 },
  },
  {
    id: 2,
    keepHp: 100,
    narrator: "The geese heard about the bread. They brought friends.",
    choice: [
      { label: "×20", op: mul(20) },
      { label: "÷2", op: div(2) },
    ],
    firstGate: { x: 50, y: 78, span: 28, drift: 0 },
    upperGates: [
      { x: 35, y: 58, span: 20, drift: 0.14, op: mul(3) },
      { x: 65, y: 44, span: 20, drift: -0.14, op: sub(10) },
      { x: 45, y: 26, span: 20, drift: 0.14, op: null },
    ],
    goose: { waveSize: 3, waveInterval: 200, maxWaves: 5 },
  },
  {
    id: 3,
    keepHp: 200,
    narrator: "Somewhere a goose is already filing a complaint.",
    choice: [
      { label: "×50", op: mul(50) },
      { label: "−5", op: sub(5) },
    ],
    firstGate: { x: 50, y: 78, span: 26, drift: 0 },
    upperGates: [
      { x: 30, y: 62, span: 18, drift: 0.16, op: div(2) },
      { x: 70, y: 50, span: 18, drift: -0.16, op: sub(10) },
      { x: 45, y: 38, span: 18, drift: 0.16, op: null },
      { x: 55, y: 24, span: 18, drift: -0.16, op: mul(3) },
    ],
    goose: { waveSize: 4, waveInterval: 180, maxWaves: 6 },
  },
  {
    id: 4,
    keepHp: 350,
    narrator: "Double the gates, double the regret. You're doing fine.",
    choice: [
      { label: "×75", op: mul(75) },
      { label: "−10", op: sub(10) },
    ],
    firstGate: { x: 50, y: 78, span: 24, drift: 0 },
    upperGates: [
      { x: 30, y: 64, span: 16, drift: 0.18, op: mul(3) },
      { x: 70, y: 54, span: 16, drift: -0.18, op: sub(10) },
      { x: 40, y: 42, span: 16, drift: 0.18, op: null },
      { x: 60, y: 30, span: 16, drift: -0.18, op: div(2) },
      { x: 50, y: 18, span: 16, drift: 0.18, op: mul(2) },
    ],
    goose: { waveSize: 5, waveInterval: 150, maxWaves: 7 },
  },
  {
    id: 5,
    keepHp: 500,
    narrator: "Final gate. The Big Mama is listening. Make it count.",
    choice: [
      { label: "×100", op: mul(100) },
      { label: "÷3", op: div(3) },
    ],
    firstGate: { x: 50, y: 78, span: 22, drift: 0 },
    upperGates: [
      { x: 30, y: 66, span: 15, drift: 0.2, op: mul(3) },
      { x: 70, y: 58, span: 15, drift: -0.2, op: sub(10) },
      { x: 40, y: 48, span: 15, drift: 0.2, op: sub(10) },
      { x: 60, y: 38, span: 15, drift: -0.2, op: null },
      { x: 50, y: 28, span: 15, drift: 0.2, op: mul(2) },
      { x: 45, y: 16, span: 15, drift: -0.2, op: div(2) },
    ],
    goose: { waveSize: 6, waveInterval: 130, maxWaves: 8 },
  },
];

export const levelCount = LEVELS.length;

export function levelConfig(id: number): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id);
}
