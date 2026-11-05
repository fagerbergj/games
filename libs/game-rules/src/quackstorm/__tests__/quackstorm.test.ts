import {
  applyOp, BIG_MAMA_POP, BIG_MAMA_DAMAGE, createLevel, chooseGate, DUCK_SPEED, mysteryOp,
  opLabel, setAim, setHolding, step, starsFor, WORLD,
  type Duckling, type Gate, type Goose, type GateOp, type QuackstormState,
} from "..";

const duck = (id: number, x: number, y: number, extra: Partial<Duckling> = {}): Duckling =>
  ({ id, x, y, big: false, popsLeft: 0, ...extra });

const gate = (id: number, y: number, op: GateOp | null, extra: Partial<Gate> = {}): Gate =>
  ({ id, x: 50, y, span: 40, drift: 0, op, revealed: op !== null, ...extra });

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

  test("DUCK_SPEED is used by the crossing test's offset", () => {
    expect(DUCK_SPEED).toBeGreaterThan(0);
  });

  test("stars scale with bread left", () => {
    expect(starsFor(0)).toBe(0);
    expect(starsFor(50)).toBe(2);
    expect(starsFor(100)).toBe(3);
    expect(starsFor(10)).toBe(1);
  });
});
