import { Router } from "express";

export const debugRouter = Router();

// Lets a logged-in staff member confirm production error reporting end to end:
// the thrown error reaches Sentry.setupExpressErrorHandler in index.ts.
debugRouter.get("/error", () => {
  throw new Error("Sentry test error");
});
