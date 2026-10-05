import { execSync } from "node:child_process";
import { e2eEnv } from "./env.js";

/** Migrates and empties the e2e database, then seeds the staff member the tests log in as. */
export default function globalSetup() {
  const env = { ...process.env, ...e2eEnv };
  execSync("npx prisma migrate deploy", { cwd: "apps/backend", env, stdio: "pipe" });
  execSync("npx tsx e2e/seed.ts", { env, stdio: "pipe" });
}
