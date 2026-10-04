import { FLEET, createGame, fire, placeFleet, resign, type BattleshipState, type Placement } from "..";
import { publicBoards } from "../protocol";

const ROWS: Placement[] = FLEET.map((s, i) => ({ ship: s.id, row: i, col: 0, vertical: false }));
const COLS: Placement[] = FLEET.map((s, i) => ({ ship: s.id, row: 0, col: 5 + i, vertical: true }));
const DESTROYER = COLS[4]; // column 9, rows 0-1

function ok(result: BattleshipState | string): BattleshipState {
  if (typeof result === "string") throw new Error(result);
  return result;
}

const playing = () => ok(placeFleet(ok(placeFleet(createGame(), 0, ROWS)), 1, COLS));

describe("publicBoards", () => {
  test("each player sees their own fleet and none of the other's", () => {
    const s = playing();
    expect(publicBoards(s, 0).map(b => b.ships)).toEqual([ROWS, []]);
    expect(publicBoards(s, 1).map(b => b.ships)).toEqual([[], COLS]);
  });

  test("an opponent's ship shows only once sunk; shots and ready pass through", () => {
    let s = ok(fire(playing(), 0, [{ row: 0, col: 9 }]));
    expect(publicBoards(s, 0)[1]).toEqual({ ready: true, shots: [{ row: 0, col: 9, hit: true }], ships: [] });
    s = ok(fire(ok(fire(s, 1, [{ row: 9, col: 9 }])), 0, [{ row: 1, col: 9 }]));
    expect(publicBoards(s, 0)[1].ships).toEqual([DESTROYER]);
    expect(publicBoards(s, 0)[1].shots).toEqual(s.boards[1].shots);
  });

  test("a spectator sees no unsunk ship on either board while the game runs", () => {
    expect(publicBoards(playing(), null).map(b => b.ships)).toEqual([[], []]);
    const placing = ok(placeFleet(createGame(), 1, COLS));
    expect(publicBoards(placing, null).map(b => b.ships)).toEqual([[], []]);
    expect(publicBoards(placing, 0)[1]).toEqual({ ready: true, shots: [], ships: [] });
  });

  test("once the game is over everyone sees both fleets", () => {
    const over = ok(resign(playing(), 1));
    for (const viewer of [0, 1, null] as const) expect(publicBoards(over, viewer).map(b => b.ships)).toEqual([ROWS, COLS]);
  });
});
