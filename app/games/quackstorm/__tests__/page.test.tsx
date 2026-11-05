import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LEVELS } from "@game-rules/quackstorm";
import QuackstormPage from "../page";

// jsdom has no ResizeObserver (the canvas fit loop) — the fit callback only
// writes canvas.width/height, so a no-op observer is a faithful stand-in.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// A chainable no-op 2d context: every draw call returns a context again, every
// property read a no-op function, every write accepted.
function fakeCtx(): CanvasRenderingContext2D {
  const target = function () {};
  return new Proxy(target, {
    get: () => () => fakeCtx(),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeCtx());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const l1 = LEVELS[0];

test("the page opens in the fake-ad choice: narrator, both gates, the controls hint", () => {
  render(<QuackstormPage />);
  expect(screen.getByRole("heading", { name: /Quackstorm/ })).toBeInTheDocument();
  expect(screen.getByText("Level 1 / 5")).toBeInTheDocument();
  // The level's own narrator and both opener labels, verbatim from the config.
  expect(screen.getByText(`“${l1.narrator}”`)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: l1.choice[0].label })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: l1.choice[1].label })).toBeInTheDocument();
  expect(screen.getByText("Drag to aim · hold to fire bread")).toBeInTheDocument();
});

test("picking a gate starts the level: the choice overlay goes away, the river stays", async () => {
  render(<QuackstormPage />);
  const river = document.querySelector("canvas");
  expect(river).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: l1.choice[1].label }));
  // The hook's animation loop notices the engine switched to "playing".
  await waitFor(() => expect(screen.queryByText(`“${l1.narrator}”`)).not.toBeInTheDocument());
  expect(document.querySelector("canvas")).not.toBeNull(); // the river (and "How to play") remain
  expect(screen.getByText("How to play")).toBeInTheDocument();
});

test("Restart returns to the choice for the same level", async () => {
  render(<QuackstormPage />);
  fireEvent.click(screen.getByRole("button", { name: l1.choice[0].label }));
  await waitFor(() => expect(screen.queryByText(`“${l1.narrator}”`)).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Restart" }));
  expect(screen.getByText(`“${l1.narrator}”`)).toBeInTheDocument();
  expect(screen.getByText("Level 1 / 5")).toBeInTheDocument();
});
