import "dotenv/config";
import "./instrument.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Sentry from "@sentry/node";
import { createApp } from "./app.js";

const port = process.env.PORT ?? 3001;

// In production Express also serves the built admin panel (ADR-0001). In dev
// the Vite dev server serves it and proxies /api here instead.
const adminPanelDir =
  process.env.ADMIN_PANEL_DIST ||
  (process.env.NODE_ENV === "production"
    ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../admin-panel/dist")
    : undefined);

const app = createApp({ adminPanelDir });

// Must come after all routes and before any other error-handling middleware.
Sentry.setupExpressErrorHandler(app);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
