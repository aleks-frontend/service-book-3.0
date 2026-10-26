import path from "node:path";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { PHOTO_FILES_PATH, photoStorageFromEnv, type PhotoStorage } from "./lib/photoStorage.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { actionsRouter } from "./routes/actions.js";
import { customersRouter } from "./routes/customers.js";
import { debugRouter } from "./routes/debug.js";
import { devicesRouter } from "./routes/devices.js";
import { meRouter } from "./routes/me.js";
import { photosRouter } from "./routes/photos.js";
import { publicServicesRouter } from "./routes/publicServices.js";
import { servicesRouter } from "./routes/services.js";
import { publicSettingsRouter, settingsRouter } from "./routes/settings.js";
import { statisticsRouter } from "./routes/statistics.js";

/** Room for both settings images at their size limit, base64-encoded, plus the text fields. */
const SETTINGS_BODY_LIMIT = "4mb";

export type AppOptions = {
  /** The admin panel's built `dist` directory. When set, it is served from `/` (ADR-0001). */
  adminPanelDir?: string;
  /** Where photos are stored. Defaults to the one the environment configures (`.env.example`). */
  photoStorage?: PhotoStorage;
};

export function createApp({
  adminPanelDir,
  photoStorage = photoStorageFromEnv(),
}: AppOptions = {}) {
  const app = express();
  // Read by the routes through `photoStorageOf(req)`.
  app.locals.photoStorage = photoStorage;

  // Better Auth reads the raw request body itself, so it must be mounted
  // before express.json() consumes it.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  // The public status page (/s/<publicToken>) reads a service without a session.
  // It takes no body, so it is mounted before any is parsed. So is the login page's company logo.
  app.use("/api/public", publicServicesRouter);
  app.use("/api/public", publicSettingsRouter);

  // Every /api route other than /api/auth and /api/public requires a logged-in staff member.
  // Checked before any body is parsed, so no one else can send a large one.
  app.use("/api", requireAuth);

  // The settings carry the logo and signature images inline.
  app.use("/api/settings", express.json({ limit: SETTINGS_BODY_LIMIT }));
  // Notes with photos are multipart, parsed by their own route (lib/photoUploads.ts).
  app.use(express.json());

  app.use("/api/me", meRouter);
  app.use("/api/debug", debugRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/devices", devicesRouter);
  app.use("/api/actions", actionsRouter);
  app.use("/api/services", servicesRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/statistics", statisticsRouter);
  app.use("/api/photos", photosRouter);
  if (photoStorage.files) app.use(PHOTO_FILES_PATH, photoStorage.files);

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
