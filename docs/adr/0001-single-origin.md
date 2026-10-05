# Single origin: Express serves the admin panel and the API

## Context

bakery-mono serves its frontends separately from its API. Service Book has one internal frontend (the admin panel) now and a public status page later. The Railway Hobby plan charges for every always-on container.

## Decision

In production, one Express process serves both the built admin panel and the API under `/api`, on one domain. It is deployed as a single Railway service plus Postgres. This makes Better Auth's session cookie first-party with no CORS or `SameSite` configuration. It also avoids a separate static-file container (the cost difference is in `techstack.md`), and the QR on the dispatch note can point to the same host.

## Consequences

- The future public status page (`/s/<publicToken>`) is a route in the same app, outside the auth guard, not a separate site.
- Express must serve the SPA's `index.html` for unknown non-`/api` paths, and `/api/*` must never fall through to it.
