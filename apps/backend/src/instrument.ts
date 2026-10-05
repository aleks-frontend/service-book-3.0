import * as Sentry from "@sentry/node";

// Imported first in index.ts: Sentry has to register its instrumentation
// before the modules it patches (Express, Prisma, …) are imported.
// No-ops if SENTRY_DSN is unset.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
});
