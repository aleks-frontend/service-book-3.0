import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Proxying keeps the API on the page's own origin in dev too, matching
    // production where Express serves this app (ADR-0001).
    proxy: {
      // 127.0.0.1, not localhost: Node resolves localhost to ::1 first, where another dev
      // server can sit on the same port and answer instead of the backend.
      "/api": "http://127.0.0.1:3001",
    },
  },
});
