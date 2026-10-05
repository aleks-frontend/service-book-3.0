import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../apps/backend/.env") });

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "E2E_DATABASE_URL must be set to run the Playwright tests (see apps/backend/.env.example).",
  );
}

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export const STAFF = {
  email: "e2e-staff@example.com",
  password: "e2e-password-123",
  name: "E2E Staff",
};

/** Environment for the production-mode backend under test and for seeding its database. */
export const e2eEnv = {
  DATABASE_URL: databaseUrl,
  PORT: String(E2E_PORT),
  BETTER_AUTH_URL: E2E_BASE_URL,
  BETTER_AUTH_SECRET: "e2e-secret-that-is-at-least-32-characters-long",
  NODE_ENV: "production",
  // The tests log in back to back, faster than Better Auth's sign-in rate limit allows.
  AUTH_RATE_LIMIT_DISABLED: "true",
};
