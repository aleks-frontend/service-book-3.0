import { createAuthClient } from "better-auth/react";

// Single origin (ADR-0001): Better Auth lives at /api/auth on the page's own
// origin, served by Express in production and proxied by Vite in dev.
export const authClient = createAuthClient({ baseURL: window.location.origin });

export const { useSession, signIn, signOut } = authClient;
