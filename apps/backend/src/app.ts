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
import { servicesRouter } from "./routes/services.js";
import { settingsRouter } from "./routes/settings.js";
import { statisticsRouter } from "./routes/statistics.js";

/** Room for both settings images at their size limit, base64-encoded, plus the text fields. */
const SETTINGS_BODY_LIMIT = "4mb";

export type AppOptions = {
  /** The admin panel's built `dist` directory. When set, it is served from `/` (ADR-0001). */
  adminPanelDir?: string;
};

export function createApp({ adminPanelDir }: AppOptions = {}) {
  const app = express();

  // Better Auth reads the raw request body itself, so it must be mounted
  // before express.json() consumes it.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  // Every /api route other than /api/auth requires a logged-in staff member.
  // Checked before any body is parsed, so no one else can send a large one.
  app.use("/api", requireAuth);

  // The settings carry the logo and signature images inline.
  app.use("/api/settings", express.json({ limit: SETTINGS_BODY_LIMIT }));
  app.use(express.json());

  app.use("/api/me", meRouter);
  app.use("/api/debug", debugRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/devices", devicesRouter);
  app.use("/api/actions", actionsRouter);
  app.use("/api/services", servicesRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/statistics", statisticsRouter);

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
