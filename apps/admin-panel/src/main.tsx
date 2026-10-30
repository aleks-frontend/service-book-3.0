import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import { Toaster } from "react-hot-toast";
import App from "./App.tsx";
import { installFileDrag } from "./lib/fileDrag";
import "./index.css";
import "./i18n";

// No-ops if VITE_SENTRY_DSN is unset.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});

installFileDrag();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        // Flat, on the theme's tokens: no shadow or rounding, a rule around it.
        style: {
          background: "hsl(var(--popover))",
          color: "hsl(var(--popover-foreground))",
          border: "1px solid hsl(var(--input))",
          borderRadius: "var(--radius)",
          boxShadow: "none",
        },
      }}
    />
  </React.StrictMode>,
);
