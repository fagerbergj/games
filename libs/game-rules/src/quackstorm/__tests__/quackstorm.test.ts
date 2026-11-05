import {
  applyOp, BIG_MAMA_POP, BIG_MAMA_DAMAGE, COLLIDE, createLevel, chooseGate, DUCK_SPEED, FIRE_COOLDOWN,
  GOOSE_STAGGER, LEVELS, mysteryOp, MYSTERY_POOL, opLabel, setAim, setHolding, step, starsFor, WORLD,
  type Duckling, type Gate, type Goose, type GateOp, type QuackstormState,
} from "..";

const duck = (id: number, x: number, y: number, extra: Partial<Duckling> = {}): Duckling =>
  ({ id, x, y, big: false, popsLeft: 0, aimed: true, dmg: 1, ...extra });

const gate = (id: number, y: number, op: GateOp | null, extra: Partial<Gate> = {}): Gate =>
  ({ id, x: 50, y, span: 40, drift: 0, op, revealed: op !== null, flock: 0, opener: false, ...extra });

/** A ready-to-step level with a controlled set of ducklings, geese and gates. */
function playing(overrides: { ducks?: Duckling[]; geese?: Goose[]; gates?: Gate[]; keepHp?: number } = {}): QuackstormState {
  const s = chooseGate(createLevel(1, 7), 0);
  return {
    ...s,
    ducklings: overrides.ducks ?? [],
    geese: overrides.geese ?? [],
    gates: overrides.gates ?? [],
    keepHp: overrides.keepHp ?? 1000,
  };
}

const clampX = (x: number) => Math.min(100, Math.max(0, x));

/** A perfect-aim bot: pops the deepest urgent goose, otherwise feeds the first gate, always holding. */
function play(level: number, pick: 0 | 1, seed = 42): QuackstormState {
  let s = setHolding(chooseGate(createLevel(level, seed), pick), true);
  for (let i = 0; i < 36000 && s.phase === "playing"; i++) {
    const firstGate = s.gates.reduce((a, b) => (b.y > a.y ? b : a));
    const urgent = s.geese.filter((g) => g.y > 40);
    const target = urgent.length > 0 ? urgent.reduce((a, b) => (b.y > a.y ? b : a)) : firstGate;
    s = step(setAim(s, clampX(target.x)));
  }
  return s;
}

/** A weak bot: feeds the first gate and only pops a goose once it is at y > 80 (barely in
 * time) — models a player who mostly watches the gates. Always holding. */
function playWeak(level: number, pick: 0 | 1, seed = 42): QuackstormState {
  let s = setHolding(chooseGate(createLevel(level, seed), pick), true);
  for (let i = 0; i < 36000 && s.phase === "playing"; i++) {
    const firstGate = s.gates.reduce((a, b) => (b.y > a.y ? b : a));
    const late = s.geese.filter((g) => g.y > 80);
    const target = late.length > 0 ? late.reduce((a, b) => (b.y > a.y ? b : a)) : firstGate;
    s = step(setAim(s, clampX(target.x)));
  }
  return s;
}

/** A late reacter (round-4 model): only starts aiming at a goose once it passes
 * y = 60, and drags the aim at 0.5 units/step toward the deepest such goose. It never
 * feeds the gates on purpose — it is the slowest player a level must still be clearable
 * by. Pins finding 2: no difficulty cliff (no 20→0 jump) between adjacent levels. */
function playLateReactor(level: number, pick: 0 | 1, seed = 42): QuackstormState {
  let s = setHolding(chooseGate(createLevel(level, seed), pick), true);
  for (let i = 0; i < 36000 && s.phase === "playing"; i++) {
    const ready = s.geese.filter((g) => g.y > 60);
    if (ready.length > 0) {
      const target = ready.reduce((a, b) => (b.y > a.y ? b : a));
      const want = clampX(target.x);
      const d = want - s.cannonX;
      s = step(setAim(s, clampX(s.cannonX + Math.max(-0.5, Math.min(0.5, d)))));
    } else {
      s = step(s);
    }
  }
  return s;
}

/** A one-shot bot: pops each goose exactly once, the step it crosses y > 60. If any
 * goose slips through, the cannon was never fast enough — it measures the stagger. */
function playOneShot(level: number, seed = 42): QuackstormState {
  let s = setHolding(chooseGate(createLevel(level, seed), 0), true);
  const shot = new Set<number>();
  for (let i = 0; i < 36000 && s.phase === "playing"; i++) {
    const firstGate = s.gates.reduce((a, b) => (b.y > a.y ? b : a));
    const ready = s.geese.filter((g) => g.y > 60 && !shot.has(g.id));
    const target = ready.length > 0 ? ready[0] : firstGate;
    if (target !== firstGate && s.fireCooldown === 0) shot.add(target.id);
    s = step(setAim(s, clampX(target.x)));
  }
  return s;
}

/** A brand-new player: never moves the aim (stays at the centre), just holds fire. */
function playPassive(level: number, pick: 0 | 1, seed: number): QuackstormState {
  let s = setHolding(chooseGate(createLevel(level, seed), pick), true);
  for (let i = 0; i < 36000 && s.phase === "playing"; i++) {
    s = step(s);
  }
  return s;
}

/** The goose-only player: perfect aim, but only at geese — the gates are pure
 * scenery, and when no goose is out the aim simply stays put. If the river of
 * geese gets deep enough it loses; the gates are the only way to finish in time. */
function playGooseOnly(level: number, pick: 0 | 1, seed: number): QuackstormState {
  let s = setHolding(chooseGate(createLevel(level, seed), pick), true);
  for (let i = 0; i < 36000 && s.phase === "playing"; i++) {
    if (s.geese.length > 0) {
      const target = s.geese.reduce((a, b) => (b.y > a.y ? b : a));
      s = step(setAim(s, clampX(target.x)));
    } else {
      s = step(s);
    }
  }
  return s;
}

describe("gate operations", () => {
  test.each<[GateOp, number, number]>([
    [{ kind: "add", value: 5 }, 1, 6],
    [{ kind: "add", value: 5 }, 10, 15],
    [{ kind: "sub", value: 10 }, 1, 0],
    [{ kind: "sub", value: 10 }, 20, 10],
    [{ kind: "mul", value: 3 }, 1, 3],
    [{ kind: "mul", value: 2 }, 4, 8],
    [{ kind: "div", value: 2 }, 1, 0],
    [{ kind: "div", value: 2 }, 5, 2],
  ])("applyOp(%j, %i) -> %i", (op, n, expected) => {
    expect(applyOp(op, n)).toBe(expected);
  });

  test("opLabel renders the four operations and the mystery", () => {
    expect(opLabel({ kind: "add", value: 5 })).toBe("+5");
    expect(opLabel({ kind: "sub", value: 10 })).toBe("−10");
    expect(opLabel({ kind: "mul", value: 2 })).toBe("×2");
    expect(opLabel({ kind: "div", value: 2 })).toBe("÷2");
    expect(opLabel(null)).toBe("?");
  });

  test.each<[GateOp, number]>([
    [{ kind: "add", value: 5 }, 6],
    [{ kind: "mul", value: 3 }, 3],
    [{ kind: "div", value: 2 }, 0],
    [{ kind: "sub", value: 10 }, 0],
  ])("a lone duckling through a %j gate becomes %i", (op, expected) => {
    const s = playing({ ducks: [duck(1, 50, 50.5)], gates: [gate(9, 50, op)] });
    const out = step(s);
    expect(out.ducklings.length).toBe(expected);
  });

  test("a flock of four through a ÷2 gate becomes two", () => {
    const s = playing({ ducks: [duck(1, 30, 50.5), duck(2, 40, 50.5), duck(3, 60, 50.5), duck(4, 70, 50.5)], gates: [gate(9, 50, { kind: "div", value: 2 })] });
    expect(step(s).ducklings.length).toBe(2);
  });

  test("a × gate accrues bread for the net gain, at the step level", () => {
    const s = playing({ ducks: [duck(1, 50, 50.5), duck(2, 51, 50.5), duck(3, 52, 50.5), duck(4, 53, 50.5)], gates: [gate(9, 50, { kind: "mul", value: 2 })] });
    const out = step(s);
    expect(out.ducklings).toHaveLength(8);
    expect(out.bread).toBe(4);
    expect(out.breadEarned).toBe(4);
  });

  test("only the direct continuations of a crossing keep the player's aim", () => {
    // A plain fan-out (a ×3 gate on a lone shot) makes copies the player never
    // aimed — none of them may earn the early-pop star credit.
    const fanned = step(playing({ ducks: [duck(1, 50, 50.5)], gates: [gate(9, 50, { kind: "mul", value: 3 })] }));
    expect(fanned.ducklings).toHaveLength(3);
    expect(fanned.ducklings.every((d) => !d.aimed)).toBe(true);
    // A survivor of the opener's subtractive toll continues the player's shot
    // (one in, one out) — it keeps the aim, the toll as Keep damage, and a pop.
    const opener = gate(9, 50, { kind: "sub", value: 4 }, { opener: true });
    const crossed = [46, 48, 50, 52, 54].map((x, i) => duck(i + 1, x, 50.5));
    const survivor = step(playing({ ducks: crossed, gates: [opener] }));
    expect(survivor.ducklings).toHaveLength(1);
    expect(survivor.ducklings[0].aimed).toBe(true);
    expect(survivor.ducklings[0].dmg).toBe(4);
    expect(survivor.ducklings[0].popsLeft).toBe(1);
    // An angry survivor through a ×2 gate: the first offspring carries on its
    // aim, the multiplied copy beyond it doesn't.
    const angry = step(playing({ ducks: [duck(1, 50, 50.5, { dmg: 4, popsLeft: 1 })], gates: [gate(9, 50, { kind: "mul", value: 2 })] }));
    expect(angry.ducklings).toHaveLength(2);
    expect(angry.ducklings[0].aimed).toBe(true);
    expect(angry.ducklings[1].aimed).toBe(false);
  });
});

describe("gate tolls across steps", () => {
  test("a single file of twenty ducklings through a −10 gate leaves ten", () => {
    // Twenty ducks in single file, two units apart, so each crosses on its own step.
    // The gate keeps a running flock: the first ten are its toll, the rest pass through.
    const ducks = Array.from({ length: 20 }, (_, i) => duck(1000 + i, 50, 50.5 + i * 2));
    let out = playing({ ducks, gates: [gate(9, 50, { kind: "sub", value: 10 })] });
    for (let i = 0; i < 200 && out.ducklings.some((d) => d.y > 50); i++) out = step(out);
    expect(out.ducklings).toHaveLength(10);
  });

  test("a single file of twenty ducklings through a ÷2 gate leaves ten", () => {
    const ducks = Array.from({ length: 20 }, (_, i) => duck(1000 + i, 50, 50.5 + i * 2));
    let out = playing({ ducks, gates: [gate(9, 50, { kind: "div", value: 2 })] });
    for (let i = 0; i < 200 && out.ducklings.some((d) => d.y > 50); i++) out = step(out);
    expect(out.ducklings).toHaveLength(10);
  });

  test("a +5 egg's five land on the first crossing, later crossings pass one for one", () => {
    // Seven ducks in single file: the first becomes six, each of the other six
    // passes straight through — the +N is a one-time-per-arm boost, paid out of the toll.
    const ducks = Array.from({ length: 7 }, (_, i) => duck(1040 + i, 50, 50.5 + i * 2));
    let out = playing({ ducks, gates: [gate(9, 50, { kind: "add", value: 5 })] });
    for (let i = 0; i < 200 && out.ducklings.some((d) => d.y > 50); i++) out = step(out);
    expect(out.ducklings).toHaveLength(12);
  });

  test("the running flock carries on: the toll is paid once, not per crossing", () => {
    // Five ducks cross, five more cross later: the −10 gate eats the first ten in total.
    const firstFive = Array.from({ length: 5 }, (_, i) => duck(1000 + i, 50, 50.5 + i * 2));
    const lastFive = Array.from({ length: 5 }, (_, i) => duck(1020 + i, 50, 62.5 + i * 2));
    let out = playing({ ducks: [...firstFive, ...lastFive], gates: [gate(9, 50, { kind: "sub", value: 10 })] });
    for (let i = 0; i < 200 && out.ducklings.some((d) => d.y > 50); i++) out = step(out);
    expect(out.ducklings).toHaveLength(0);
    // A 21st duck, alone, now passes straight through the paid-off gate.
    out = step({ ...out, ducklings: [duck(99, 50, 50.5)] });
    expect(out.ducklings).toHaveLength(1);
  });

  test("a goose wave does not re-arm the toll: a lone shot after the wave still passes", () => {
    // Eleven cross the toll early; the level's first goose wave spawns at step 600
    // (L1's firstWaveAt). A lone shot after the wave must pass — the toll was paid
    // and the wave left it paid. (Per-wave re-arming would have eaten it.)
    const eleven = Array.from({ length: 11 }, (_, i) => duck(1000 + i, 50, 50.5 + i * 2));
    let out = playing({ ducks: eleven, gates: [gate(9, 50, { kind: "sub", value: 10 })] });
    for (let i = 0; i < 758 && out.phase === "playing"; i++) out = step(out);
    expect(out.waveNumber).toBe(1);
    // x 15: outside L1's central goose lane (46-54), so the shot cannot trade
    // with the wave's goose on its way to the toll.
    out = step({ ...out, ducklings: [duck(99, 15, 94)] });
    for (let i = 0; i < 70; i++) out = step(out);
    expect(out.ducklings).toHaveLength(1);
  });

  test("the toll re-arms on the fixed timer: a paid gate eats the first shot of a new arm", () => {
    // Eleven cross (toll paid, flock 11). The lone duck crossing just before the
    // TOLL_REARM_STEPS re-arm still passes; the next one, after it, is eaten.
    const eleven = Array.from({ length: 11 }, (_, i) => duck(1000 + i, 50, 50.5 + i * 2));
    let out = playing({ ducks: eleven, gates: [gate(9, 50, { kind: "sub", value: 10 })] });
    out = { ...out, nextWaveAt: 100000 }; // no goose waves: isolate the timer
    for (let i = 0; i < 838; i++) out = step(out);
    expect(out.gates[0].flock).toBe(11);
    out = step({ ...out, ducklings: [...out.ducklings, duck(2000, 50, 94)] }); // crosses at 897
    for (let i = 0; i < 63; i++) out = step(out); // now at step 902: the re-arm happened at 900
    expect(out.ducklings).toHaveLength(1); // it crossed into the paid flock and passed
    expect(out.gates[0].flock).toBe(0); // the fixed timer re-armed at step 900
    out = step({ ...out, ducklings: [...out.ducklings, duck(2001, 50, 94)] }); // crosses at 961
    for (let i = 0; i < 68; i++) out = step(out);
    expect(out.ducklings).toHaveLength(0); // the fresh arm eats it
    expect(out.gates[0].flock).toBe(1);
    expect(out.keepHp).toBe(998); // only the 11th and the pre-rearm duck reached the Keep
  });

  test("a full wave of single shots at the fire rate passes the −10 gate (re-arm elapsed)", () => {
    // The toll is paid by eleven early crossings. A full L1 wave (waveInterval steps
    // = eight shots at the fire rate) then straddles the level's first goose wave:
    // the wave no longer re-arms, so every shot in the wave passes.
    const eleven = Array.from({ length: 11 }, (_, i) => duck(1000 + i, 50, 50.5 + i * 2));
    let out = setAim(playing({ ducks: eleven, gates: [gate(9, 50, { kind: "sub", value: 10 })] }), 50);
    const waveInterval = out.waveInterval; // L1: 240; the first wave is at 600, inside 480-720.
    for (let i = 0; i < 480 && out.phase === "playing"; i++) out = step(out);
    const base = out.keepHp;
    for (let i = 480; i < 480 + waveInterval && out.phase === "playing"; i++) {
      // x 15: outside L1's central goose lane (46-54), so no shot trades with a goose.
      out = i % FIRE_COOLDOWN === 0
        ? step({ ...out, ducklings: [...out.ducklings, duck(3000 + i, 15, 94)] })
        : step(out);
    }
    for (let i = 480 + waveInterval; i < 830 && out.phase === "playing"; i++) out = step(out);
    // Eight shots fired (waveInterval / FIRE_COOLDOWN); all eight reached the Keep.
    expect(base - out.keepHp).toBe(8);
  });
});

describe("gate counting", () => {
  test("a gate counts each crossing duckling once: two through ×2 make four, not eight", () => {
    const s = playing({ ducks: [duck(1, 30, 50.5), duck(2, 70, 50.5)], gates: [gate(9, 50, { kind: "mul", value: 2 })] });
    const out = step(s);
    expect(out.ducklings.length).toBe(4);
  });

  test("a duckling that already passed a gate is not counted again by it", () => {
    // Start the duck above the gate; it never crosses it this step.
    const s = playing({ ducks: [duck(1, 50, 49.2)], gates: [gate(9, 50, { kind: "mul", value: 3 })] });
    const out = step(s);
    expect(out.ducklings.length).toBe(1);
  });
});

describe("duckling and goose", () => {
  test("a duckling and a goose that meet both pop, one for one", () => {
    const s = playing({ ducks: [duck(1, 50, 50.5)], geese: [{ id: 2, x: 50, y: 50.5 }] });
    const out = step(s);
    expect(out.ducklings).toHaveLength(0);
    expect(out.geese).toHaveLength(0);
  });

  test("a duckling far from a goose survives the step", () => {
    const s = playing({ ducks: [duck(1, 50, 40.5)], geese: [{ id: 2, x: 50, y: 80.5 }] });
    const out = step(s);
    expect(out.ducklings).toHaveLength(1);
    expect(out.geese).toHaveLength(1);
  });
});

describe("Keep damage", () => {
  test("a duckling that reaches the Keep takes one point off it", () => {
    const s = playing({ keepHp: 10, ducks: [duck(1, 50, 6.2)] });
    const out = step(s);
    expect(out.keepHp).toBe(9);
    expect(out.ducklings).toHaveLength(0);
  });
});

describe("Big Mama", () => {
  test("a Big Mama pops a goose it meets and keeps paddling", () => {
    const s = playing({
      keepHp: 100,
      ducks: [duck(1, 50, 50.5, { big: true, popsLeft: BIG_MAMA_POP })],
      geese: [{ id: 2, x: 50, y: 50.5 }],
    });
    const out = step(s);
    expect(out.geese).toHaveLength(0);
    expect(out.ducklings).toHaveLength(1);
    expect(out.ducklings[0].big).toBe(true);
    expect(out.ducklings[0].popsLeft).toBe(BIG_MAMA_POP - 1);
  });

  test("a Big Mama pops at most ten geese", () => {
    const s = playing({
      keepHp: 100,
      ducks: [duck(1, 50, 50.5, { big: true, popsLeft: 1 })],
      geese: [
        { id: 2, x: 50, y: 50.5 },
        { id: 3, x: 50, y: 50.5 },
      ],
    });
    const out = step(s);
    expect(out.geese).toHaveLength(1);
    expect(out.ducklings[0].popsLeft).toBe(0);
  });

  test("a spent Big Mama (popsLeft 0) has no pops left: it trades one for one and sinks", () => {
    const s = playing({
      keepHp: 100,
      ducks: [duck(1, 50, 50.5, { big: true, popsLeft: 0 })],
      geese: [{ id: 2, x: 50, y: 50.5 }],
    });
    const out = step(s);
    expect(out.geese).toHaveLength(0);
    expect(out.ducklings).toHaveLength(0);
  });

  test("a Big Mama that reaches the Keep deals ten", () => {
    const s = playing({ keepHp: 20, ducks: [duck(1, 50, 6.2, { big: true, popsLeft: BIG_MAMA_POP })] });
    const out = step(s);
    expect(out.keepHp).toBe(20 - BIG_MAMA_DAMAGE);
    expect(out.ducklings).toHaveLength(0);
  });

  test("holding with a full bread meter fires a Big Mama that resets the meter", () => {
    const s = chooseGate({ ...createLevel(1, 3), bread: 100 }, 0);
    const out = step(setHolding(s, true));
    expect(out.ducklings).toHaveLength(1);
    expect(out.ducklings[0].big).toBe(true);
    expect(out.bread).toBe(0);
  });
});

describe("win and lose", () => {
  test("the Keep reaching 0 wins the level", () => {
    const s = playing({ keepHp: 2, ducks: [duck(1, 50, 6.2), duck(2, 52, 6.2)] });
    const out = step(s);
    expect(out.phase).toBe("won");
    expect(out.keepHp).toBe(0);
  });

  test("a goose reaching the cannon loses the level", () => {
    const s = playing({ keepHp: 100, geese: [{ id: 1, x: 50, y: WORLD.cannonY - 0.1 }] });
    const out = step(s);
    expect(out.phase).toBe("lost");
  });
});

describe("mystery eggs", () => {
  test("the same seed gives the same mystery-egg result", () => {
    expect(mysteryOp(7, 4)).toEqual(mysteryOp(7, 4));
  });

  test("an egg reveals a real operation when first crossed, and replays identically", () => {
    const run = () => step(playing({ ducks: [duck(1, 50, 50.5)], gates: [gate(4, 50, null)] }));
    const a = run();
    const b = run();
    expect(a.gates[0].op).not.toBeNull();
    expect(a.gates[0].revealed).toBe(true);
    expect(a.gates[0].op).toEqual(b.gates[0].op);
    expect(a.gates[0].op).toEqual(mysteryOp(7, 4));
    expect(a.ducklings.length).toBe(applyOp(a.gates[0].op!, 1));
  });

  test("different eggs in the same level reveal different-deterministic operations", () => {
    const s = step(playing({ ducks: [duck(1, 50, 50.5)], gates: [gate(4, 50, null)] }));
    const t = step(playing({ ducks: [duck(1, 50, 50.5)], gates: [gate(99, 50, null)] }));
    expect(s.gates[0].op).toEqual(mysteryOp(7, 4));
    expect(t.gates[0].op).toEqual(mysteryOp(7, 99));
  });

  test("a mystery egg never reveals a toll: the pool has no subtract", () => {
    // A − player's stream is already thin after the opener's toll — a surprise −10
    // on top would set the level for half the seeds. Mysteries multiply, add or divide.
    expect(MYSTERY_POOL.every((op) => op.kind !== "sub")).toBe(true);
  });
});

describe("level difficulty", () => {
  test("difficulty rises from level 1 to level 5", () => {
    // Total geese a level throws: waveSize is constant per wave (see spawnWave).
    const totalGeese = (cfg: (typeof LEVELS)[number]) => cfg.goose.waveSize * cfg.goose.maxWaves;
    for (let i = 1; i < LEVELS.length; i++) {
      const a = LEVELS[i - 1];
      const b = LEVELS[i];
      expect(b.keepHp).toBeGreaterThan(a.keepHp);
      expect(totalGeese(b)).toBeGreaterThan(totalGeese(a));
      expect(Math.abs(b.firstGate.drift)).toBeGreaterThanOrEqual(Math.abs(a.firstGate.drift));
      expect(b.firstGate.span).toBeLessThanOrEqual(a.firstGate.span);
    }
    // L1's first wave is the latest of all levels: a new player gets to watch the
    // gates work before a goose decides for them.
    const firstWaveAt = (l: (typeof LEVELS)[number]) => l.goose.firstWaveAt ?? l.goose.waveInterval;
    expect(firstWaveAt(LEVELS[0])).toBeGreaterThan(
      Math.max(...LEVELS.slice(1).map(firstWaveAt)),
    );
    expect(LEVELS[0].goose.waveInterval).toBeGreaterThan(
      Math.max(...LEVELS.slice(1).map((l) => l.goose.waveInterval)),
    );
  });

  test("the perfect-aim bot's time to clear rises from level 1 to level 5", () => {
    const times = LEVELS.map((l) => {
      const s = play(l.id, 0);
      expect(s.phase).toBe("won");
      return s.stepCount;
    });
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });

  test("a late-rescue bot wins every level: no difficulty cliff", () => {
    // The curve used to jump here: the weak bot won 20/20 at L3 but only 7/20 at L4
    // and 0/20 at L5, because a whole goose wave marched down in step — faster than
    // the cannon's cooldown, so late players had nothing they could reach. Waves are
    // now staggered (GOOSE_STAGGER), so the same bot clears every level.
    for (const l of LEVELS) {
      expect(playWeak(l.id, 0).phase, `L${l.id}`).toBe("won");
    }
  });

  test("a late-rescue bot's time to clear rises from level 1 to level 5", () => {
    const times = LEVELS.map((l) => {
      const s = playWeak(l.id, 0);
      expect(s.phase).toBe("won");
      return s.stepCount;
    });
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });

  test("a one-shot bot pops every goose: the cannon can keep up with the waves", () => {
    for (const l of LEVELS) {
      const s = playOneShot(l.id);
      // A goose that reaches the cannon ends the level as lost, so a win means
      // every goose in the level was popped.
      expect(s.phase, `L${l.id}`).toBe("won");
    }
  });

  test("the late-reacter bot: no adjacent-level drop greater than 12/20 (20 seeds, − opener)", () => {
    // Round-7: the round-6 15/20 floor "forbids F3" — a floor that
    // high means a player who never aims the gates can still clear, so the gates
    // don't decide the game. The pin is now a drop cap: between adjacent levels
    // the late-reacter's win rate may fall at most 12/20, so difficulty still
    // rises without a cliff. Pinned on the − opener: its thinner, angrier stream
    // makes the level longer (more geese to pop), so it is the harder of the two
    // openers.
    const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
    const wins = LEVELS.map((l) =>
      SEEDS.filter((seed) => playLateReactor(l.id, 1, seed).phase === "won").length,
    );
    for (let i = 1; i < wins.length; i++) {
      expect(wins[i - 1] - wins[i], `L${i}→L${i + 1}: ${wins.join("→")}`).toBeLessThanOrEqual(12);
    }
  });

  test("the subtractive opener clears in at most 1.5x the multiplicative one on L1-L5 (perfect and weak, 20 seeds)", () => {
    // Round-6 finding 1: the wrong (−) opener must not be a grind. On every level the
    // − opener's average clear time over 20 seeds is at most 1.5x the × opener's, for
    // both the perfect bot and the weak bot. The angry survivors carrying the toll
    // (dmg = the opener's value, released on every level) keep the − stream
    // competitive, so no level special-cases it.
    const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
    const avgRatio = (bot: (level: number, pick: 0 | 1, seed?: number) => QuackstormState) =>
      LEVELS.map((l) => {
        let good = 0;
        let bad = 0;
        for (const seed of SEEDS) {
          const g = bot(l.id, 0, seed);
          const b = bot(l.id, 1, seed);
          expect(g.phase, `L${l.id} seed ${seed} ×`).toBe("won");
          expect(b.phase, `L${l.id} seed ${seed} −`).toBe("won");
          good += g.stepCount;
          bad += b.stepCount;
        }
        return { id: l.id, ratio: bad / good };
      });
    for (const bot of [play, playWeak]) {
      for (const { id, ratio } of avgRatio(bot)) {
        expect(ratio, `L${id} −/× ${ratio.toFixed(2)}`).toBeLessThanOrEqual(1.5);
      }
    }
  });
});

describe("gates decide the game", () => {
  const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

  test("goose-only loses on each of L3–L5: the endless waves catch a player who never aims the gates (20 seeds, − opener)", () => {
    // Round-7 (F3): the gates must decide the game. The goose-only bot
    // (perfect aim at geese, the gates pure scenery) used to win 20/20 on every
    // level; the endless waves after maxWaves make dawdling cost the level. The
    // target is ≥3/20 losses per level with at least one opener — pinned on −,
    // whose longer level puts the player deeper into the endless river.
    for (const level of [3, 4, 5]) {
      const losses = SEEDS.filter((seed) => playGooseOnly(level, 1, seed).phase === "lost").length;
      expect(losses, `L${level} − losses ${losses}/20`).toBeGreaterThanOrEqual(3);
    }
  });

  test("goose-only still wins L1–L2: the endless river starts where the gates start to matter (20 seeds, both openers)", () => {
    for (const level of [1, 2]) {
      for (const pick of [0, 1] as const) {
        for (const seed of SEEDS) {
          expect(playGooseOnly(level, pick, seed).phase, `L${level} ${pick === 0 ? "×" : "−"} seed ${seed}`).toBe("won");
        }
      }
    }
  });

  test("perfect and weak still win every level, both openers (20 seeds)", () => {
    for (const l of LEVELS) {
      for (const pick of [0, 1] as const) {
        for (const seed of SEEDS) {
          expect(play(l.id, pick, seed).phase, `perfect L${l.id} ${pick === 0 ? "×" : "−"} seed ${seed}`).toBe("won");
          expect(playWeak(l.id, pick, seed).phase, `weak L${l.id} ${pick === 0 ? "×" : "−"} seed ${seed}`).toBe("won");
        }
      }
    }
  });
});

describe("stars reward play", () => {
  const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

  test("the weak bot with × gets 3★ on at most 10/20 seeds, L2–L5 (20 seeds)", () => {
    // Round-7 finding 3: the weak bot used to get 3★ on 20/20 seeds with × on
    // L2 and L5 — stars didn't reward anything. Star time is clear time plus one
    // fire-rate per goose that reached the kill line, minus one per aimed pop
    // above it, so the gate-feeding bot is the one who outruns the threshold.
    for (const level of [2, 3, 4, 5]) {
      const three = SEEDS.filter((seed) => playWeak(level, 0, seed).stars === 3).length;
      expect(three, `L${level} × 3★ ${three}/20`).toBeLessThanOrEqual(10);
    }
  });

  test("the perfect bot's mean stars are at least the weak bot's (20 seeds, × opener, every level)", () => {
    // Round-8: with the aim bookkeeping fixed, × is the higher-star opener on
    // every level for both bots (pinned above), so within the × opener the
    // play-quality ranking holds: the bot that feeds the gates early and pops
    // before the kill line is the one the stars reward.
    for (const l of LEVELS) {
      const mean = (bot: (level: number, pick: 0 | 1, seed: number) => QuackstormState) =>
        SEEDS.reduce((sum, seed) => sum + bot(l.id, 0, seed).stars, 0) / SEEDS.length;
      expect(mean(play), `L${l.id} × mean`).toBeGreaterThanOrEqual(mean(playWeak));
    }
  });

  test("the × opener earns strictly more mean stars than the − opener, every level (20 seeds, perfect and weak)", () => {
    // Round-8 finding 1: the − opener used to earn as many stars as ×, or more —
    // fan() gave every offspring of an angry crossing the player's aim, so the
    // ×2 copies of − survivors earned the early-pop credit (L4: 21.1 credits per
    // − run against 2.9 for ×), and a slow − clear beat a fast × one (L4 seed 4:
    // − in 35.4 s for 3★ against × in 27.4 s for 2★). Only the first
    // `crossing.length` offspring carry on the aim now; L1's three-star bar was
    // re-measured to 790 with the credit; and the L3 opener is −3 — a higher
    // toll would make − faster, because the anger damage equals the toll.
    for (const l of LEVELS) {
      for (const bot of [play, playWeak]) {
        const stars = (pick: 0 | 1) => SEEDS.map((seed) => bot(l.id, pick, seed).stars);
        const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        expect(mean(stars(0)), `L${l.id} mean stars × > −`).toBeGreaterThan(mean(stars(1)));
        const outruns = stars(0).filter((s, i) => stars(1)[i] > s).length;
        expect(outruns, `L${l.id} − outruns × on ${outruns}/20 seeds`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("full levels", () => {
  test.each(LEVELS.map((l) => l.id))("level %i is winnable with the multiplicative opener", (id) => {
    expect(play(id, 0).phase).toBe("won");
  });

  test.each(LEVELS.slice(0, -1).map((l) => l.id))(
    "level %i: the subtractive opener wins, but slower",
    (id) => {
      const good = play(id, 0);
      const bad = play(id, 1);
      expect(bad.phase).toBe("won");
      expect(bad.stepCount).toBeGreaterThan(good.stepCount);
    },
  );

  test("level 5: the subtractive opener no longer stalls the level (20 seeds)", () => {
    // The −5 toll used to starve the whole 30-shot arm through the toll stack, and
    // 7 of 20 seeds ran to the 600 s cap with a live cannon. Now the opener releases
    // angry survivors carrying the toll (dmg = the opener's − value), so the wrong
    // pick costs time: every seed still wins, every one slower than the × opener, and none
    // drifts far from it.
    for (let seed = 1; seed <= 20; seed++) {
      const good = play(5, 0, seed);
      const bad = play(5, 1, seed);
      expect(good.phase, `seed ${seed} ×`).toBe("won");
      expect(bad.phase, `seed ${seed} −`).toBe("won");
      expect(bad.stepCount, `seed ${seed}`).toBeGreaterThan(good.stepCount);
      expect(bad.stepCount, `seed ${seed}`).toBeLessThanOrEqual(good.stepCount * 1.5);
    }
  });
});

describe("opener survivors", () => {
  const subOpen = () => {
    const s = chooseGate(createLevel(5, 42), 1);
    const opener = s.gates.find((g) => g.opener)!;
    return { s, opener };
  };

  test("the L5 −5 opener releases angry survivors: Keep damage and one goose-pop each", () => {
    const { s, opener } = subOpen();
    // A small flock one step above the opener: 6 cross the −5 toll, 1 survives.
    const xs = [47, 48.5, 50, 51.5, 53, 54.5];
    let st = {
      ...s,
      ducklings: xs.map((x, i) => duck(i + 1, x, opener.y + 0.4)),
      gates: [opener],
    };
    st = step(st);
    const survivors = st.ducklings;
    expect(survivors).toHaveLength(1);
    expect(survivors[0].popsLeft).toBe(1);
    expect(survivors[0].dmg).toBe(5);
  });

  test("an angry survivor pops a goose like a small Big Mama: pops, keeps paddling", () => {
    const { s } = subOpen();
    let st: QuackstormState = {
      ...s,
      // Already upstream of the opener toll, on the way to the Keep.
      ducklings: [duck(1, 50, 70, { dmg: 5, popsLeft: 1 })],
      gates: [],
      geese: [{ id: 2, x: 50, y: 40.5 }],
    };
    for (let i = 0; i < 200 && st.ducklings.length > 0; i++) {
      st = step(st);
      if (st.geese.length === 0) break;
    }
    expect(st.geese).toHaveLength(0);
    expect(st.ducklings[0].popsLeft).toBe(0);
    expect(st.ducklings[0].dmg).toBe(5);
  });

  test("an angry survivor's offspring inherit the anger at fan gates", () => {
    const { s } = subOpen();
    let st = {
      ...s,
      ducklings: [duck(1, 50, 48.4, { dmg: 5, popsLeft: 1 })],
      gates: [{ ...gate(3, 48, { kind: "mul", value: 2 }), opener: false }],
    };
    st = step(st);
    expect(st.ducklings).toHaveLength(2);
    for (const d of st.ducklings) {
      expect(d.dmg).toBe(5);
      expect(d.popsLeft).toBe(1);
    }
  });

  test("a spent angry survivor passes no fresh pop to its offspring: they carry the remaining pops", () => {
    // Round-6 smaller fix: a survivor that already spent its goose-pop (popsLeft 0) must
    // not get a fresh one at the next gate. The ×2 gate doubles the crossing; the
    // offspring inherit the survivor's remaining pops (0), not a new one.
    const { s } = subOpen();
    let st = {
      ...s,
      // The survivor already spent its goose-pop; only its anger (dmg 5) remains.
      ducklings: [duck(1, 50, 48.4, { dmg: 5, popsLeft: 0 })],
      gates: [{ ...gate(3, 48, { kind: "mul", value: 2 }), opener: false }],
    };
    st = step(st);
    expect(st.ducklings).toHaveLength(2);
    for (const d of st.ducklings) {
      expect(d.dmg).toBe(5);
      expect(d.popsLeft).toBe(0);
    }
  });

  test("the multiplicative opener releases plain ducklings", () => {
    const s = chooseGate(createLevel(5, 42), 0);
    const opener = s.gates.find((g) => g.opener)!;
    const xs = [47, 48.5, 50, 51.5, 53, 54.5];
    let st = { ...s, ducklings: xs.map((x, i) => duck(i + 1, x, opener.y + 0.4)), gates: [opener] };
    st = step(st);
    expect(st.ducklings.length).toBeGreaterThan(0);
    expect(st.ducklings.every((d) => d.dmg === 1 && d.popsLeft === 0)).toBe(true);
  });

  test("every level's subtractive opener releases angry survivors carrying the toll", () => {
    for (const id of [1, 2, 3, 4, 5]) {
      const s = chooseGate(createLevel(id, 42), 1);
      const opener = s.gates.find((g) => g.opener)!;
      const xs = [47, 48.5, 50, 51.5, 53, 54.5];
      let st = { ...s, ducklings: xs.map((x, i) => duck(i + 1, x, opener.y + 0.4)), gates: [opener] };
      st = step(st);
      const toll = opener.op!.value;
      expect(st.ducklings.length, `L${id}`).toBe(xs.length - toll);
      expect(st.ducklings.every((d) => d.dmg === toll && d.popsLeft === 1), `L${id}`).toBe(true);
    }
  });
});

describe("goose waves", () => {
  const spawnGeese = (s: QuackstormState): QuackstormState => {
    let st = s;
    for (let i = 0; i < 1200 && st.geese.length === 0 && st.phase === "playing"; i++) {
      st = step(st);
    }
    return st;
  };

  test("geese in a wave are staggered by the level's wave stagger, not marching in step", () => {
    const s = spawnGeese(chooseGate(createLevel(5, 42), 0));
    const ys = s.geese.map((g) => g.y).sort((a, b) => a - b);
    expect(ys.length).toBeGreaterThanOrEqual(2);
    // L-5 uses a custom 42 stagger (the default is GOOSE_STAGGER = 21).
    expect(ys[0] - ys[1]).toBeCloseTo(-(LEVELS[4].goose.stagger ?? GOOSE_STAGGER), 5);
  });

  test("level 1's geese march the central lane a stationary aim can reach", () => {
    const cfg = LEVELS[0];
    const s = spawnGeese(chooseGate(createLevel(1, 1235), 0));
    expect(s.geese.length).toBeGreaterThan(0);
    for (const g of s.geese) {
      expect(g.x).toBeGreaterThanOrEqual(cfg.goose.x0!);
      expect(g.x).toBeLessThanOrEqual(cfg.goose.x1!);
      // The lane fits inside the cannon's COLLIDE range of the centre: a player who
      // never moves the aim still reaches every goose.
      expect(Math.abs(g.x - 50)).toBeLessThan(COLLIDE);
    }
  });
});

describe("the new player", () => {
  test("holding fire at the centre wins level 1 with either opener", () => {
    // The exact seed and posture from the round-5 review: aim 50, fire held, no
    // aim moves — the −2 opener used to lose it at 21.9 s.
    expect(playPassive(1, 0, 1235).phase).toBe("won");
    expect(playPassive(1, 1, 1235).phase).toBe("won");
    for (let seed = 1; seed <= 20; seed++) {
      expect(playPassive(1, 0, seed).phase, `seed ${seed} ×`).toBe("won");
      expect(playPassive(1, 1, seed).phase, `seed ${seed} −`).toBe("won");
    }
  });

  test("the passive player: no 20→0 jump between adjacent levels (20 seeds, both openers)", () => {
    // Round-7 finding 2: the passive cliff moved from L3→L4 to L2→L3 (passive
    // won L2 20/20, then L3 0/20 with −). L2's lane (44–56) is now wider than
    // L1's (46–54), so a centre aim starts missing the edge geese on L2; the
    // measured ramp 20→13→2→0 (×) and 20→3→0→0 (−) keeps every adjacent pair
    // from being a 20→0 cliff.
    const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
    for (const pick of [0, 1] as const) {
      const wins = LEVELS.map((l) =>
        SEEDS.filter((seed) => playPassive(l.id, pick, seed).phase === "won").length,
      );
      for (let i = 1; i < wins.length; i++) {
        expect(
          wins[i - 1] === 20 && wins[i] === 0,
          `L${i}→L${i + 1} ${pick === 0 ? "×" : "−"}: ${wins.join("→")}`,
        ).toBe(false);
      }
    }
  });
});

describe("opener and controls", () => {
  test("a level opens in the choice phase and the pick becomes the first gate", () => {
    const s = createLevel(1, 5);
    expect(s.phase).toBe("choice");
    expect(s.choice).toHaveLength(2);
    const picked = chooseGate(s, 0);
    expect(picked.phase).toBe("playing");
    const firstGate = picked.gates[picked.gates.length - 1];
    expect(firstGate.op).toEqual(s.choice[0].op);
  });

  test("the choice is real: picking index 1 sets the other gate", () => {
    const s = createLevel(1, 5);
    const picked = chooseGate(s, 1);
    expect(picked.gates.some((g) => g.op && g.op.kind === s.choice[1].op.kind && g.op.value === s.choice[1].op.value)).toBe(true);
  });

  test("setAim clamps the cannon within the river", () => {
    const s = createLevel(1, 5);
    expect(setAim(s, -20).cannonX).toBe(0);
    expect(setAim(s, 140).cannonX).toBe(WORLD.width);
    expect(setAim(s, 33).cannonX).toBe(33);
  });

  test("a duckling that lands a hair above the gate line still counts as crossing", () => {
    // 1e-9 of float wobble: without the crossing epsilon this duck would wait a step.
    const s = playing({ ducks: [duck(1, 50, 50 + DUCK_SPEED + 1e-9)], gates: [gate(9, 50, { kind: "mul", value: 2 })] });
    const out = step(s);
    expect(out.ducklings.length).toBe(2);
  });

  test("stars are time-based: a faster clear earns more stars", () => {
    // Time-based (not bread-based): per-level star times, and a win is always at
    // least one star. Boundaries are inclusive.
    const t = { three: 1000, two: 1600 };
    expect(starsFor(0, t)).toBe(3);
    expect(starsFor(1000, t)).toBe(3); // exactly at the 3-star line
    expect(starsFor(1001, t)).toBe(2); // one step past it
    expect(starsFor(1600, t)).toBe(2); // exactly at the 2-star line
    expect(starsFor(1601, t)).toBe(1); // a slow win is still a win
    expect(starsFor(99999, t)).toBe(1);
  });
});
