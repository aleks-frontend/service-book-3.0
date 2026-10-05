export interface HttpError extends Error {
  status: number;
  details?: unknown;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Turns ISO date strings in API responses back into real `Date` objects. */
function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === "string" && ISO_DATE_RE.test(value) ? new Date(value) : value;
}

/**
 * A 401 means the session expired or was revoked. A full page load (rather
 * than a client-side navigate) also resets Better Auth's cached session, so
 * the login page doesn't bounce straight back into the app.
 */
function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

/** Calls the backend's `/api` on the page's own origin with the session cookie. */
export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    redirectToLogin();
  }

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text, reviveDates) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed: ${response.status}`;
    const error = new Error(message) as HttpError;
    error.status = response.status;
    error.details = data && typeof data === "object" && "details" in data ? data.details : data;
    throw error;
  }

  return data as T;
}
