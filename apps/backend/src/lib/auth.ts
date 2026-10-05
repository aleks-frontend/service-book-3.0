import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";

// Single origin (ADR-0001): in production the admin panel is served by this
// same Express app, and in dev Vite proxies /api, so the session cookie is
// always first-party. Only the Vite dev server needs listing for origin checks.
const trustedOrigins = process.env.TRUSTED_ORIGINS
  ? process.env.TRUSTED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : ["http://localhost:5173"];

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // Staff members are created by the seed/CLI command, never by public sign-up.
    disableSignUp: true,
  },
  trustedOrigins,
  // Better Auth rate-limits sign-in in production (3 attempts per 10 s per IP).
  // Only the Playwright run turns it off, since its tests log in back to back.
  rateLimit: process.env.AUTH_RATE_LIMIT_DISABLED === "true" ? { enabled: false } : undefined,
});
