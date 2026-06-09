import type { PlaywrightTestConfig } from "playwright/test";

const config: PlaywrightTestConfig = {
  testDir: "./app/games/kings-corner/__tests__",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
};

export default config;
