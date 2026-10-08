import path from "node:path";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { actionsRouter } from "./routes/actions.js";
import { customersRouter } from "./routes/customers.js";
import { debugRouter } from "./routes/debug.js";
import { devicesRouter } from "./routes/devices.js";
import { meRouter } from "./routes/me.js";

export type AppOptions = {
  /** The admin panel's built `dist` directory. When set, it is served from `/` (ADR-0001). */
  adminPanelDir?: string;
};

export function createApp({ adminPanelDir }: AppOptions = {}) {
  const app = express();

  // Better Auth reads the raw request body itself, so it must be mounted
  // before express.json() consumes it.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json());

  // Every /api route other than /api/auth requires a logged-in staff member.
  app.use("/api", requireAuth);
  app.use("/api/me", meRouter);
  app.use("/api/debug", debugRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/devices", devicesRouter);
  app.use("/api/actions", actionsRouter);

  // Unknown API paths must never fall through to the admin panel's index.html.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  if (adminPanelDir) {
    app.use(express.static(adminPanelDir));
    // Client-side routes (e.g. /customers?service=…) are resolved by React Router.
    app.get("*splat", (_req, res) => {
      res.sendFile(path.join(adminPanelDir, "index.html"));
    });
  }

  return app;
}
