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
      "/api": "http://localhost:3001",
    },
  },
});
