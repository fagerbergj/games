import {
  BOARD_SIZE, FLEET, createGame, fire, isSunk, pass, placeFleet, placementError, randomFleet, resign, shipCells,
  shotsAllowed, sunkShips, type BattleshipState, type Coord, type Placement, type Seat,
} from "..";

/** mulberry32: a tiny seeded uniform [0, 1) source so fuzz failures replay exactly. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ships stacked in rows 0-4 from column 0: carrier row 0 ... destroyer row 4.
const ROWS: Placement[] = FLEET.map((s, i) => ({ ship: s.id, row: i, col: 0, vertical: false }));

function ok(result: BattleshipState | string): BattleshipState {
  if (typeof result === "string") throw new Error(result);
  return result;
}

function started(opts?: { salvo?: boolean }): BattleshipState {
  return ok(placeFleet(ok(placeFleet(createGame(opts), 0, ROWS)), 1, ROWS));
}

const allCells = (): Coord[] =>
  Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({ row: Math.floor(i / BOARD_SIZE), col: i % BOARD_SIZE }));

describe("placement", () => {
  test("shipCells runs right, or down when vertical", () => {
    expect(shipCells({ ship: "destroyer", row: 2, col: 3, vertical: false })).toEqual([{ row: 2, col: 3 }, { row: 2, col: 4 }]);
    expect(shipCells({ ship: "cruiser", row: 7, col: 9, vertical: true }).map(c => c.row)).toEqual([7, 8, 9]);
  });

  test("a full, in-bounds, non-overlapping fleet is valid, and touching ships are allowed", () => {
    expect(placementError(ROWS)).toBeNull();
  });

  test.each<[string, Placement[], string]>([
    ["missing ship", ROWS.slice(1), "place exactly one of each ship"],
    ["duplicate ship", [...ROWS.slice(0, 4), { ...ROWS[3], row: 9 }], "place exactly one of each ship"],
    ["off the right edge", [{ ...ROWS[0], col: 6 }, ...ROWS.slice(1)], "carrier runs off the board"],
    ["off the bottom edge", [...ROWS.slice(0, 4), { ship: "destroyer", row: 9, col: 9, vertical: true }], "destroyer runs off the board"],
    ["negative", [{ ...ROWS[0], row: -1 }, ...ROWS.slice(1)], "carrier runs off the board"],
    ["fractional", [{ ...ROWS[0], col: 0.5 }, ...ROWS.slice(1)], "carrier runs off the board"],
    ["overlap", [...ROWS.slice(0, 4), { ship: "destroyer", row: 3, col: 1, vertical: true }], "destroyer overlaps another ship"],
  ])("%s is rejected", (_, fleet, error) => {
    expect(placementError(fleet)).toContain(error);
  });

  test("placing readies the player; the game starts with seat 0 once both are ready", () => {
    const one = ok(placeFleet(createGame(), 1, ROWS));
    expect(one.phase).toBe("placing");
    expect(one.boards.map(b => b.ready)).toEqual([false, true]);
    expect(placeFleet(one, 1, ROWS)).toBe("your fleet is already placed");
    const both = ok(placeFleet(one, 0, ROWS));
    expect(both).toMatchObject({ phase: "playing", turn: 0 });
    expect(placeFleet(both, 0, ROWS)).toBe("placement is over");
  });

  test("an invalid fleet leaves the state untouched", () => {
    const game = createGame();
    expect(placeFleet(game, 0, ROWS.slice(1))).toMatch(/exactly one of each/);
    expect(game.boards[0]).toEqual({ fleet: [], ready: false, shots: [] });
  });
});

describe("firing", () => {
  test("hits and misses land on the opponent's board and the turn alternates", () => {
    let g = started();
    g = ok(fire(g, 0, [{ row: 0, col: 0 }]));
    expect(g.boards[1].shots).toEqual([{ row: 0, col: 0, hit: true }]);
    expect(g.turn).toBe(1);
    g = ok(fire(g, 1, [{ row: 9, col: 9 }]));
    expect(g.boards[0].shots).toEqual([{ row: 9, col: 9, hit: false }]);
    expect(g.turn).toBe(0);
  });

  test.each<[string, Seat, Coord[], string]>([
    ["out of turn", 1, [{ row: 0, col: 0 }], "not your turn"],
    ["off the board", 0, [{ row: 10, col: 0 }], "that shot is off the board"],
    ["no shot", 0, [], "fire exactly one shot"],
    ["two shots without salvo", 0, [{ row: 0, col: 0 }, { row: 0, col: 1 }], "fire exactly one shot"],
  ])("%s is rejected", (_, seat, targets, error) => {
    expect(fire(started(), seat, targets)).toBe(error);
  });

  test("firing at a cell twice is rejected", () => {
    const g = ok(fire(ok(fire(started(), 0, [{ row: 5, col: 5 }])), 1, [{ row: 5, col: 5 }]));
    expect(fire(g, 0, [{ row: 5, col: 5 }])).toBe("you already fired there");
  });

  test("no firing before both fleets are placed", () => {
    expect(fire(createGame(), 0, [{ row: 0, col: 0 }])).toBe("the game isn't in play");
  });

  test("a ship sinks when its last cell is hit; sinking the whole fleet wins", () => {
    let g = started();
    const targets = ROWS.flatMap(shipCells);
    for (const [i, t] of targets.entries()) {
      g = ok(fire(g, 0, [t]));
      if (i === 1) expect(sunkShips(g.boards[1])).toEqual([]);
      if (i === 4) expect(sunkShips(g.boards[1]).map(p => p.ship)).toEqual(["carrier"]);
      if (g.phase === "over") break;
      g = ok(fire(g, 1, [allCells()[99 - i]]));
    }
    expect(g).toMatchObject({ phase: "over", winner: 0 });
    expect(g.boards[1].fleet.every(p => isSunk(p, g.boards[1].shots))).toBe(true);
    expect(fire(g, 1, [{ row: 9, col: 0 }])).toBe("the game isn't in play");
  });
});

describe("salvo variant", () => {
  test("is off by default", () => {
    expect(createGame().salvo).toBe(false);
    expect(shotsAllowed(started(), 0)).toBe(1);
  });

  test("fires one shot per ship afloat, falling as ships sink", () => {
    let g = started({ salvo: true });
    expect(shotsAllowed(g, 0)).toBe(5);
    expect(fire(g, 0, [{ row: 0, col: 0 }])).toBe("fire exactly 5 shots");
    // Seat 0 sinks the destroyer (row 4) and opens up the carrier.
    g = ok(fire(g, 0, [{ row: 4, col: 0 }, { row: 4, col: 1 }, { row: 0, col: 0 }, { row: 9, col: 9 }, { row: 9, col: 8 }]));
    expect(g.boards[1].shots.filter(s => s.hit)).toHaveLength(3);
    expect(shotsAllowed(g, 1)).toBe(4);
    expect(shotsAllowed(g, 0)).toBe(5);
  });

  test("repeated targets within one salvo are rejected", () => {
    const g = started({ salvo: true });
    const same = Array(5).fill({ row: 3, col: 3 });
    expect(fire(g, 0, same)).toBe("you already fired there");
  });
});

describe("pass and resign", () => {
  test("pass hands the turn over without a shot", () => {
    const g = ok(pass(started(), 0));
    expect(g.turn).toBe(1);
    expect(g.boards[1].shots).toEqual([]);
    expect(pass(g, 0)).toBe("not your turn");
  });

  test("resigning hands the win to the other seat, even mid-placement", () => {
    expect(ok(resign(createGame(), 0))).toMatchObject({ phase: "over", winner: 1 });
    expect(resign(ok(resign(started(), 1)), 0)).toBe("the game is already over");
  });
});

describe("determinism and serialisation", () => {
  test("state survives a JSON round trip and keeps playing identically", () => {
    const g = ok(fire(started({ salvo: true }), 0, allCells().slice(50, 55)));
    const copy = JSON.parse(JSON.stringify(g)) as BattleshipState;
    expect(copy).toEqual(g);
    expect(fire(copy, 1, allCells().slice(0, 5))).toEqual(fire(g, 1, allCells().slice(0, 5)));
  });

  test("moves never mutate their input", () => {
    const g = started();
    const before = JSON.stringify(g);
    fire(g, 0, [{ row: 0, col: 0 }]);
    pass(g, 0);
    resign(g, 0);
    expect(JSON.stringify(g)).toBe(before);
  });

  test("the same seed gives the same fleet", () => {
    expect(randomFleet(seeded(7))).toEqual(randomFleet(seeded(7)));
    expect(randomFleet(seeded(7))).not.toEqual(randomFleet(seeded(8)));
  });
});

describe("placement fuzz (seeded)", () => {
  const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

  test("every random fleet is legal and covers exactly 17 distinct cells", () => {
    for (const seed of SEEDS) {
      const fleet = randomFleet(seeded(seed));
      expect(placementError(fleet), `seed ${seed}`).toBeNull();
      expect(new Set(fleet.flatMap(shipCells).map(c => `${c.row},${c.col}`)).size).toBe(17);
    }
  });

  test("moving one ship onto another's cell, or past the edge, is always caught", () => {
    for (const seed of SEEDS) {
      const rng = seeded(seed);
      const fleet = randomFleet(rng);
      const a = Math.floor(rng() * 5);
      const b = (a + 1 + Math.floor(rng() * 4)) % 5;
      const onto = shipCells(fleet[b])[0];
      const overlapped = fleet.map((p, i) => (i === a ? { ...p, ...onto } : p));
      expect(placementError(overlapped), `seed ${seed}`).not.toBeNull();
      const edge = fleet.map((p, i) => (i === a ? { ...p, [p.vertical ? "row" : "col"]: BOARD_SIZE - 1 } : p));
      expect(placementError(edge), `seed ${seed}`).toMatch(/runs off the board|overlaps/);
    }
  });

  test("random games always end with exactly one winner whose opponent lost all 17 cells", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const rng = seeded(seed);
      const salvo = seed % 2 === 0;
      let g = ok(placeFleet(ok(placeFleet(createGame({ salvo }), 0, randomFleet(rng))), 1, randomFleet(rng)));
      for (let turn = 0; g.phase === "playing"; turn++) {
        expect(turn, `seed ${seed}`).toBeLessThan(200);
        const fired = new Set(g.boards[g.turn === 0 ? 1 : 0].shots.map(s => s.row * 10 + s.col));
        const open = allCells().filter(c => !fired.has(c.row * 10 + c.col)).sort(() => rng() - 0.5);
        g = ok(fire(g, g.turn, open.slice(0, shotsAllowed(g, g.turn))));
      }
      const loser = g.boards[g.winner === 0 ? 1 : 0];
      expect(loser.shots.filter(s => s.hit)).toHaveLength(17);
      expect(sunkShips(loser)).toHaveLength(5);
    }
  });
});
