import {
  BIG_MAMA_DAMAGE, BIG_MAMA_POP, COLLIDE, CROSS_EPS, DUCK_SPEED, FIRE_COOLDOWN, GOOSE_SPEED, MAX_BREAD, STAR_RATIO, WORLD,
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

/**
 * Stars on the win end-card, 0-3. Judged by total bread earned against the level's
 * Keep HP — stable and player-controlled (aim quality plus the opener pick). The
 * meter left is not: a Big Mama empties it, so it only measures time since the last
 * Big Mama.
 */
export function starsFor(breadEarned: number, keepMaxHp: number): number {
  const ratio = keepMaxHp > 0 ? breadEarned / keepMaxHp : 0;
  if (ratio >= STAR_RATIO.three) return 3;
  if (ratio >= STAR_RATIO.two) return 2;
  if (ratio >= STAR_RATIO.one) return 1;
  return 0;
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
    nextWaveAt: cfg.goose.waveInterval,
    waveNumber: 0,
    maxWaves: cfg.goose.maxWaves,
    waveSize: cfg.goose.waveSize,
    waveInterval: cfg.goose.waveInterval,
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
  st.ducklings.push({ id: st.nextId++, x: st.cannonX, y: WORLD.cannonY, big, popsLeft: big ? BIG_MAMA_POP : 0 });
  if (big) st.bread = 0;
  st.fireCooldown = FIRE_COOLDOWN;
}

/**
 * Fan `count` ducklings out across the gate's zone, just above its line. A lone
 * pass-through (one in, one out) keeps the duckling's own x, so it paddles straight on.
 */
function fan(gate: Gate, count: number, crossing: Duckling[], nextId: () => number): Duckling[] {
  const ducks: Duckling[] = [];
  for (let i = 0; i < count; i++) {
    const straight = count === 1 && crossing.length === 1 ? crossing[0].x : null;
    const frac = count === 1 ? 0.5 : i / (count - 1);
    ducks.push({
      id: nextId(),
      x: straight ?? clamp(gate.x - gate.span + frac * 2 * gate.span, 1, WORLD.width - 1),
      y: gate.y - 1,
      big: false,
      popsLeft: 0,
    });
  }
  return ducks;
}

/**
 * Apply every gate a duckling crossed this step. Each gate keeps a running count
 * (`flock`) of everything that has passed through since its toll last armed, and the
 * operation is taken as a toll from that count: a −10 gate eats the first ten ducklings,
 * then passes the rest one for one, instead of wiping out every duckling that crosses
 * alone. A new goose wave re-arms every toll (see `spawnWave`). A × gate also adds its
 * net gain to the bread meter and the level's `breadEarned`.
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
    st.ducklings = st.ducklings.concat(fan(gate, out, crossing, () => st.nextId++));
  }
}

/** Duckling-goose meetings: normal ducks pop one for one; a Big Mama pops and keeps going. */
function resolveCollisions(ducklings: Duckling[], geese: Goose[]): { ducklings: Duckling[]; geese: Goose[] } {
  const deadDucks = new Set<number>();
  const deadGeese = new Set<number>();
  for (const g of geese) {
    if (deadGeese.has(g.id)) continue;
    for (const d of ducklings) {
      if (deadDucks.has(d.id)) continue;
      const dx = d.x - g.x;
      const dy = d.y - g.y;
      if (dx * dx + dy * dy >= COLLIDE * COLLIDE) continue;
      if (d.big) {
        if (d.popsLeft > 0) {
          d.popsLeft--;
          deadGeese.add(g.id);
          // One pop per step: the next goose meets this Big Mama on a later step.
          break;
        }
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
    if (d.y <= WORLD.keepY) hp -= d.big ? BIG_MAMA_DAMAGE : 1;
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
    st.geese.push({ id: st.nextId++, x: 8 + r * (WORLD.width - 16), y: WORLD.keepY + 6 });
  }
  // A new wave re-arms every toll: a −10 gate keeps eating ten on every wave, so toll
  // gates matter all level instead of drying up after their first ten crossings.
  for (const gate of st.gates) gate.flock = 0;
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
    st.stars = starsFor(st.breadEarned, st.keepMaxHp);
  } else if (st.geese.some((g) => g.y >= WORLD.cannonY)) {
    st.phase = "lost";
  }
  st.stepCount++;
  return st;
}

export * from "./types";
export * from "./levels";
export { mysteryOp, mulberryStep, MYSTERY_POOL } from "./rng";
