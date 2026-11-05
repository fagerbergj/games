import {
  applyOp, BIG_MAMA_POP, BIG_MAMA_DAMAGE, createLevel, chooseGate, DUCK_SPEED, LEVELS, mysteryOp,
  opLabel, setAim, setHolding, step, starsFor, WORLD,
  type Duckling, type Gate, type Goose, type GateOp, type QuackstormState,
} from "..";

const duck = (id: number, x: number, y: number, extra: Partial<Duckling> = {}): Duckling =>
  ({ id, x, y, big: false, popsLeft: 0, ...extra });

const gate = (id: number, y: number, op: GateOp | null, extra: Partial<Gate> = {}): Gate =>
  ({ id, x: 50, y, span: 40, drift: 0, op, revealed: op !== null, flock: 0, ...extra });

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
  });
});

describe("full levels", () => {
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

  test.each(LEVELS.map((l) => l.id))("level %i is winnable with the multiplicative opener", (id) => {
    expect(play(id, 0).phase).toBe("won");
  });

  test.each(LEVELS.map((l) => l.id))("level %i: the subtractive opener wins, but slower", (id) => {
    const good = play(id, 0);
    const bad = play(id, 1);
    expect(bad.phase).toBe("won");
    expect(bad.stepCount).toBeGreaterThan(good.stepCount);
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

  test("stars scale with bread earned against the level's Keep HP", () => {
    expect(starsFor(0, 100)).toBe(0);
    expect(starsFor(12, 100)).toBe(0);
    expect(starsFor(50, 100)).toBe(1);
    expect(starsFor(80, 100)).toBe(2);
    expect(starsFor(120, 100)).toBe(3);
  });
});
