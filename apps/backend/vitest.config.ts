import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config();

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must be set to run the API tests (see .env.example).");
}

export default defineConfig({
  test: {
    // Every test file talks to the same real Postgres database, reset between
    // tests, so files must not run concurrently.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_URL: "http://localhost:3001",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
    },
    globalSetup: ["./test/globalSetup.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});
