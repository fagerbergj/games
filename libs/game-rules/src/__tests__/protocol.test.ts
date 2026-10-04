import { parseMessage, ROOM_PARSERS } from "../protocol";

const parse = (raw: string) => parseMessage(raw, ROOM_PARSERS);

test("create names its game, or leaves it out for the default", () => {
  expect(parse('{"type":"create","name":"Ann","game":"blackjack"}')).toEqual({ type: "create", name: "Ann", game: "blackjack" });
  expect(parse('{"type":"create"}')).toEqual({ type: "create", name: "Player" });
  expect(parse('{"type":"create","game":"chess"}')).toBe("unknown game");
});

test("a game's message types are unknown to the room envelope alone", () => {
  expect(parse('{"type":"bet","amount":5}')).toBe("unknown message type");
  expect(parse('{"type":7}')).toBe("unknown message type");
});

test("join may name the game it expects", () => {
  expect(parse('{"type":"join","code":"ABCDEF","game":"battleship"}')).toEqual({ type: "join", code: "ABCDEF", name: "Player", game: "battleship" });
  expect(parse('{"type":"join","code":"ABCDEF","game":"go"}')).toBe("unknown game");
});
