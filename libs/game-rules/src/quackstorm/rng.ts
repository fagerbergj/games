import type { GateOp } from "./types";

/**
 * mulberry32 as a pure step: returns the next uniform [0, 1) value and the next state.
 * Kept as a step (rather than a closure) so it folds into plain-JSON state.
 */
export function mulberryStep(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** The operation pool a mystery egg can reveal. */
export const MYSTERY_POOL: GateOp[] = [
  { kind: "mul", value: 2 },
  { kind: "mul", value: 3 },
  { kind: "add", value: 5 },
  { kind: "sub", value: 10 },
  { kind: "div", value: 2 },
];

/**
 * The operation a mystery egg at `gateId` reveals for `seed`. Derived from the pair
 * alone, so it is the same no matter when or in what order the egg is crossed.
 */
export function mysteryOp(seed: number, gateId: number): GateOp {
  const mixed = (seed ^ Math.imul(gateId + 1, 0x9e3779b1)) >>> 0;
  const [r] = mulberryStep(mixed);
  return MYSTERY_POOL[Math.min(MYSTERY_POOL.length - 1, Math.floor(r * MYSTERY_POOL.length))];
}
