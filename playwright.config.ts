import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, e2eEnv } from "./e2e/env.js";

export default defineConfig({
  testDir: "./e2e",
  // Tests share one seeded staff member and database.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalSetup: "./e2e/globalSetup.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // The production build: Express serves the admin panel and the API from one origin (ADR-0001).
  webServer: {
    command: "npm run build && npm run start",
    url: `${E2E_BASE_URL}/login`,
    env: e2eEnv,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
