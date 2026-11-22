import "@testing-library/jest-dom";

// Node >= 26 ships a native `localStorage` accessor that is undefined unless
// --localstorage-file is given, and vitest's populateGlobal skips keys that
// already exist on globalThis — so jsdom's localStorage never gets exposed.
// Expose jsdom's instead.
if (typeof globalThis.localStorage === "undefined") {
  const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
  if (jsdomWindow) {
    Object.defineProperty(globalThis, "localStorage", {
      value: jsdomWindow.localStorage,
      configurable: true,
      writable: true,
    });
  }
}
