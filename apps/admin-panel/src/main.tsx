import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import { Toaster } from "react-hot-toast";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// No-ops if VITE_SENTRY_DSN is unset.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
  </React.StrictMode>,
);
