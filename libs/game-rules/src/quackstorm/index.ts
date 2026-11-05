import {
  BIG_MAMA_DAMAGE, BIG_MAMA_POP, COLLIDE, CROSS_EPS, DUCK_SPEED, FIRE_COOLDOWN, GOOSE_SPEED, GOOSE_STAGGER, MAX_BREAD, TOLL_REARM_STEPS, WORLD,
  type Duckling, type Gate, type GateOp, type Goose, type QuackstormState,
} from "./types";
import { LEVELS, levelConfig } from "./levels";
import { mulberryStep, mysteryOp } from "./rng";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Apply a gate operation to a flock size. Never negative. */
export function applyOp(op: GateOp, n: number): number {
  let r: number;
  switch (op.kind) {
    case "add": r = n + op.value; break;
    case "sub": r = n - op.value; break;
    case "mul": r = n * op.value; break;
    case "div": r = Math.floor(n / op.value); break;
  }
  return Math.max(0, Math.round(r));
}

/** Human label for an operation: `+5`, `−10`, `×2`, `÷2`. */
export function opLabel(op: GateOp | null): string {
  if (!op) return "?";
  switch (op.kind) {
    case "add": return `+${op.value}`;
    case "sub": return `−${op.value}`;
    case "mul": return `×${op.value}`;
    case "div": return `÷${op.value}`;
  }
}

/** Clear-time star thresholds, in fixed steps: three stars for a fast clear, two
 * for a safe one, one for surviving at all. Judged by time because time is what
 * play quality buys in this game: a player who aims the gates and pops the geese
 * clears before a sloppy one, whatever either earns at the gates. (Bread earned
 * cannot rank players — two players feeding the same gates earn the same bread.)
 */
export function starsFor(steps: number, starTimes: { three: number; two: number }): number {
  if (steps <= starTimes.three) return 3;
  if (steps <= starTimes.two) return 2;
  return 1;
}

/** A fresh level in the fake-ad opener phase, ready to pick a first gate. */
export function createLevel(levelId: number, seed: number = 1234): QuackstormState {
  const cfg = levelConfig(levelId) ?? LEVELS[0];
  const gates: Gate[] = cfg.upperGates.map((spec, i) => ({
    id: i + 1,
    x: spec.x,
    y: spec.y,
    span: spec.span,
    drift: spec.drift,
    op: spec.op ? { ...spec.op } : null,
    revealed: spec.op !== null,
    flock: 0,
    opener: false,
  }));
  return {
    seed,
    level: cfg.id,
    phase: "choice",
    keepHp: cfg.keepHp,
    keepMaxHp: cfg.keepHp,
    bread: 0,
    breadEarned: 0,
    cannonX: WORLD.width / 2,
    holding: false,
    fireCooldown: 0,
    stepCount: 0,
    ducklings: [],
    geese: [],
    gates,
    nextId: gates.length + 1,
    nextWaveAt: cfg.goose.firstWaveAt ?? cfg.goose.waveInterval,
    waveNumber: 0,
    maxWaves: cfg.goose.maxWaves,
    waveSize: cfg.goose.waveSize,
    waveInterval: cfg.goose.waveInterval,
    waveStagger: cfg.goose.stagger ?? GOOSE_STAGGER,
    gooseX0: cfg.goose.x0 ?? 8,
    gooseX1: cfg.goose.x1 ?? 92,
    choice: cfg.choice.map((c) => ({ label: c.label, op: { ...c.op } })),
    narrator: cfg.narrator,
    stars: 0,
    rng: seed >>> 0,
  };
}

/** Pick one of the two opener gates; it becomes the first gate on the river. */
export function chooseGate(state: QuackstormState, index: 0 | 1): QuackstormState {
  if (state.phase !== "choice") return state;
  const cfg = levelConfig(state.level) ?? LEVELS[0];
  const gate: Gate = {
    id: state.nextId,
    x: cfg.firstGate.x,
    y: cfg.firstGate.y,
    span: cfg.firstGate.span,
    drift: cfg.firstGate.drift,
    op: { ...state.choice[index].op },
    revealed: true,
    flock: 0,
    opener: true,
  };
  return { ...state, gates: [...state.gates, gate], nextId: state.nextId + 1, phase: "playing" };
}

/** Aim the bread cannon (0..100). */
export function setAim(state: QuackstormState, x: number): QuackstormState {
  return { ...state, cannonX: clamp(x, 0, WORLD.width) };
}

/** Start or stop holding to fire. */
export function setHolding(state: QuackstormState, holding: boolean): QuackstormState {
  return { ...state, holding };
}

/** Launch one duckling (a Big Mama when the bread meter is full). Mutates `st`. */
function launch(st: QuackstormState, big: boolean): void {
  st.ducklings.push({
    id: st.nextId++,
    x: st.cannonX,
    y: WORLD.cannonY,
    big,
    popsLeft: big ? BIG_MAMA_POP : 0,
    dmg: big ? BIG_MAMA_DAMAGE : 1,
  });
  if (big) st.bread = 0;
  st.fireCooldown = FIRE_COOLDOWN;
}

/**
 * Fan `count` ducklings out across the gate's zone, just above its line. A lone
 * pass-through (one in, one out) keeps the duckling's own x, so it paddles straight on.
 * `boost` marks anger: the angry survivors the opener's subtractive toll releases,
 * or the remaining anger (Keep damage plus the crossing flock's leftover goose-pops)
 * that an angry flock's offspring inherit.
 */
function fan(
  gate: Gate,
  count: number,
  crossing: Duckling[],
  nextId: () => number,
  boost?: { dmg: number; popsLeft: number },
): Duckling[] {
  const ducks: Duckling[] = [];
  for (let i = 0; i < count; i++) {
    const straight = count === 1 && crossing.length === 1 ? crossing[0].x : null;
    const frac = count === 1 ? 0.5 : i / (count - 1);
    ducks.push({
      id: nextId(),
      x: straight ?? clamp(gate.x - gate.span + frac * 2 * gate.span, 1, WORLD.width - 1),
      y: gate.y - 1,
      big: false,
      popsLeft: boost?.popsLeft ?? 0,
      dmg: boost?.dmg ?? 1,
    });
  }
  return ducks;
}

/**
 * Apply every gate a duckling crossed this step. Each gate keeps a running count
 * (`flock`) of everything that has passed through since its toll last armed, and the
 * operation is taken as a toll from that count: a −10 gate eats the first ten ducklings,
 * then passes the rest one for one, instead of wiping out every duckling that crosses
 * alone. Tolls re-arm on a fixed timer (TOLL_REARM_STEPS, see `step`) — deliberately
 * not on every goose wave, which would eat every lone shot again. A × gate also adds
 * its net gain to the bread meter and the level's `breadEarned`.
 * Mutates `st.ducklings`, `st.bread` and `st.breadEarned`.
 */
function applyGates(st: QuackstormState): void {
  const ordered = [...st.gates].sort((a, b) => a.y - b.y);
  for (const gate of ordered) {
    const crossing = st.ducklings.filter(
      (d) => !d.big && Math.abs(d.x - gate.x) <= gate.span && d.y <= gate.y + CROSS_EPS && d.y + DUCK_SPEED >= gate.y - CROSS_EPS,
    );
    if (crossing.length === 0) continue;
    if (gate.op === null) {
      gate.op = mysteryOp(st.seed, gate.id);
      gate.revealed = true;
    }
    // What the gate has produced so far: nothing until the first crossing (the
    // baseline f(0) of a +5 gate is not five ducks that already left the pad).
    const before = gate.flock === 0 ? 0 : applyOp(gate.op, gate.flock);
    gate.flock += crossing.length;
    const out = Math.max(0, applyOp(gate.op, gate.flock) - before);
    if (gate.op.kind === "mul") {
      const gain = Math.max(0, out - crossing.length);
      st.bread = Math.min(MAX_BREAD, st.bread + gain);
      st.breadEarned += gain;
    }
    const crossed = new Set(crossing.map((d) => d.id));
    st.ducklings = st.ducklings.filter((d) => !crossed.has(d.id));
    // The opener's angry survivors, and their offspring: the sadness is contagious.
    // A plain duckling that survives the opener's subtractive toll leaves angry —
    // it carries the toll as its Keep damage and one goose-pop, so the wrong pick
    // costs stars and seconds, not the level, on any level. The pop matters: a
    // − player's thin stream must still defend the Keep against the wave flood,
    // where a × player's Big Mammas do it. An angry duckling that crosses another
    // gate passes its anger on as-is: the offspring keep the crossing flock's
    // remaining pops, never a fresh one.
    const allAngry = crossing.length > 0 && crossing.every((d) => d.dmg > 1);
    const allPlain = crossing.length > 0 && crossing.every((d) => d.dmg === 1);
    const boost = allAngry
      ? { dmg: crossing[0].dmg, popsLeft: Math.min(...crossing.map((d) => d.popsLeft)) }
      : gate.opener && gate.op.kind === "sub" && allPlain
        ? { dmg: gate.op.value, popsLeft: 1 }
        : undefined;
    st.ducklings = st.ducklings.concat(fan(gate, out, crossing, () => st.nextId++, boost));
  }
}

/** Duckling-goose meetings: normal ducks pop one for one and sink; angry
 * survivors (popsLeft 1) and Big Mamas pop and keep paddling. One pop per duckling
 * per step: a duck that popped keeps paddling and meets the next goose later. */
function resolveCollisions(ducklings: Duckling[], geese: Goose[]): { ducklings: Duckling[]; geese: Goose[] } {
  const deadDucks = new Set<number>();
  const deadGeese = new Set<number>();
  const spent = new Set<number>();
  for (const g of geese) {
    if (deadGeese.has(g.id)) continue;
    for (const d of ducklings) {
      if (deadDucks.has(d.id) || spent.has(d.id)) continue;
      const dx = d.x - g.x;
      const dy = d.y - g.y;
      if (dx * dx + dy * dy >= COLLIDE * COLLIDE) continue;
      if (d.popsLeft > 0) {
        d.popsLeft--;
        deadGeese.add(g.id);
        spent.add(d.id);
        break;
      } else {
        deadDucks.add(d.id);
        deadGeese.add(g.id);
        break;
      }
    }
  }
  return {
    ducklings: ducklings.filter((d) => !deadDucks.has(d.id)),
    geese: geese.filter((g) => !deadGeese.has(g.id)),
  };
}

/** Ducklings that reach the Keep deal damage. Returns the survivors and new Keep HP. */
function applyKeepDamage(ducklings: Duckling[], keepHp: number): { ducklings: Duckling[]; keepHp: number } {
  let hp = keepHp;
  const survivors: Duckling[] = [];
  for (const d of ducklings) {
    if (d.y <= WORLD.keepY) hp -= d.big ? BIG_MAMA_DAMAGE : d.dmg;
    else survivors.push(d);
  }
  return { ducklings: survivors, keepHp: hp };
}

/** Spawn the next goose wave when its time comes. Mutates `st`. */
function spawnWave(st: QuackstormState): void {
  if (st.waveNumber >= st.maxWaves || st.stepCount < st.nextWaveAt) return;
  for (let i = 0; i < st.waveSize; i++) {
    const [r, ns] = mulberryStep(st.rng);
    st.rng = ns;
    st.geese.push({
      id: st.nextId++,
      x: st.gooseX0 + r * (st.gooseX1 - st.gooseX0),
      // Staggered: each goose in the wave waits the level's stagger (default
      // GOOSE_STAGGER) above the last, so a one-shot player can pop every member
      // of the wave as it crosses their aim.
      y: WORLD.keepY + 6 - i * st.waveStagger,
    });
  }
  st.waveNumber++;
  st.nextWaveAt += st.waveInterval;
}

function cloneState(s: QuackstormState): QuackstormState {
  return {
    ...s,
    ducklings: s.ducklings.map((d) => ({ ...d })),
    geese: s.geese.map((g) => ({ ...g })),
    gates: s.gates.map((g) => ({ ...g })),
  };
}

/** Advance the simulation one fixed step. The single source of game motion. */
export function step(state: QuackstormState): QuackstormState {
  if (state.phase !== "playing") return state;
  const st = cloneState(state);

  if (st.holding && st.fireCooldown <= 0) launch(st, st.bread >= MAX_BREAD);
  st.fireCooldown = Math.max(0, st.fireCooldown - 1);

  for (const d of st.ducklings) d.y -= DUCK_SPEED;
  for (const g of st.geese) g.y += GOOSE_SPEED;
  for (const gate of st.gates) {
    gate.x += gate.drift;
    if (gate.x < 6) { gate.x = 6; gate.drift *= -1; }
    else if (gate.x > WORLD.width - 6) { gate.x = WORLD.width - 6; gate.drift *= -1; }
  }

  applyGates(st);
  const hit = resolveCollisions(st.ducklings, st.geese);
  st.ducklings = hit.ducklings;
  st.geese = hit.geese;
  const keep = applyKeepDamage(st.ducklings, st.keepHp);
  st.ducklings = keep.ducklings;
  st.keepHp = keep.keepHp;
  spawnWave(st);

  if (st.keepHp <= 0) {
    st.keepHp = 0;
    st.phase = "won";
    st.stars = starsFor(st.stepCount, (levelConfig(st.level) ?? LEVELS[0]).starTimes);
  } else if (st.geese.some((g) => g.y >= WORLD.cannonY)) {
    st.phase = "lost";
  }
  st.stepCount++;
  // Toll re-arm on a fixed timer, not per goose wave: long enough that most single
  // shots at the fire rate pass through, frequent enough that a −10 still matters
  // all level. (Tolls start armed at level start, flock 0.)
  if (st.stepCount % TOLL_REARM_STEPS === 0) {
    for (const gate of st.gates) gate.flock = 0;
  }
  return st;
}

export * from "./types";
export * from "./levels";
export { mysteryOp, mulberryStep, MYSTERY_POOL } from "./rng";
