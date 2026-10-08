# Tech stack

Service Book 3.0 is a rebuild of the old Firebase-backed Service Book app on the same stack as `bakery-mono`. Phase 1 reaches parity with the old app and adds login.

Domain vocabulary is in [`GLOSSARY.md`](./GLOSSARY.md), and architectural decisions are in [`docs/adr/`](./docs/adr).

## Monorepo layout

- **npm workspaces**, the same as bakery-mono. There is no Turborepo or Nx: two apps and a shared package run fine on plain workspace scripts.
  ```
  apps/
    backend/       ← Express API; serves the built admin panel in production
    admin-panel/   ← React admin app for staff members
  packages/
    schemas/       ← shared Zod schemas and types (request/response shapes)
    api-client/    ← (later) shared TanStack Query hooks, once a second frontend exists
  ```
- **Language and module system:** TypeScript everywhere, ESM (`"type": "module"`, NodeNext resolution on the backend).
- **Linting and formatting:** ESLint 9 flat config + Prettier at the root, copied from bakery-mono.

## Backend

- **Node.js 22 + Express 5 + TypeScript**, run with `tsx` in development and compiled with `tsc` for production.
- **Better Auth** for authentication:
  - Prisma adapter (Postgres), with database-backed sessions.
  - Email + password only, `disableSignUp: true`. There is no public sign-up. Staff members are created with a seed/CLI command using Better Auth's internal adapter (`createUser` + `linkAccount`), as in the bakery seed.
  - Mounted with `toNodeHandler` at `/api/auth/*splat` **before** `express.json()`.
  - A `requireAuth` middleware (`auth.api.getSession` with `fromNodeHeaders`) guards every other `/api` route.
  - There are no roles: all staff members are equal.
- **Zod** validates every route boundary, using the schemas from `packages/schemas`. Validation errors return 400 with issue details.
- **Error mapping:** a foreign-key violation on delete (Prisma `P2003`, wrapping the `DriverAdapterError`) maps to 409 with a translatable error code, e.g. `CUSTOMER_IN_USE`.
- **Single origin:** in production, Express serves the admin panel's static build and falls back to `index.html` for non-`/api` paths. See [ADR-0001](./docs/adr/0001-single-origin.md).
- **Sentry** (`@sentry/node`) for error reporting.

## Database and ORM

- **PostgreSQL** (Railway Postgres in production, local Postgres in development).
- **Prisma 7:**
  - `prisma-client` generator writing the generated client inside the backend source tree.
  - `@prisma/adapter-pg` driver adapter.
  - `prisma.config.ts` reading `DATABASE_URL`.
- **Main models:**
  - Customer, Device (nullable owner), Action
  - Service, ServiceDevice, ServiceLine (`WORK` | `SALE`), ServiceLogEntry
  - Settings (singleton), a per-year service number counter
  - Better Auth's tables
- **Identifiers and money:** UUID primary keys and integer RSD amounts. Imported records keep their legacy ID.
- **Migrations** use `prisma migrate`. Production applies them on container start (`prisma migrate deploy`).

## Frontend (admin panel)

- **React 18 + TypeScript + Vite.**
- **UI kit:** Tailwind CSS 3 and bakery-mono's shadcn-style primitives (button, input, select, dialog, drawer/sheet, table, dropdown-menu, tabs, …) built on Radix UI, `class-variance-authority`, `tailwind-merge` and `tailwindcss-animate`.
- **Icons and toasts:** lucide-react for icons, react-hot-toast for toasts.
- **React Router 7.** The open service drawer is a `?service=<id>` search param, so it can be deep-linked and closed with the back button.
- **Server state:** TanStack Query.
  - The Services list uses infinite queries (cursor pagination).
  - Customers and Devices use offset pagination with 10/25/50 rows per page.
- **Tables:** TanStack Table.
- **Forms:** react-hook-form + Zod resolvers, with the same schemas as the backend.
- **i18next:** `sr` (default), `hu` and `en`. The chosen language is persisted, and dates and numbers are formatted per locale.
- **@react-pdf/renderer** produces the dispatch note (with a QR code of the public link) and the service report, client-side.
- **Recharts** draws the earnings chart.
- **HTTP client:** a small fetch wrapper with `credentials: "include"` that revives ISO date strings and redirects to login on 401.
- **Sentry** (`@sentry/react`).

## Testing

- **Vitest + Supertest:** the primary seam. They exercise the HTTP API end to end against a real Postgres test database (`servicebook_test`), reset between tests, with an authenticated agent for a seeded staff member.
- **Legacy import:** run against an anonymised Firebase fixture committed to the repo, with results asserted through the HTTP API. The real export is never committed.
- **Playwright:** a thin end-to-end layer covering login and the redirect to login when logged out, creating a service through the "Add" modal, the `?service=` drawer (deep link and back button), and generating a dispatch note.
- **Not tested separately:** React components, PDF layouts and internal helpers. They are covered through the seams above.
- **Development style:** test-first at these seams.

## Hosting and operations

- **Railway**, in a separate project from bakery-mono. It has one service (Docker image: backend + built admin panel) plus Railway Postgres.
- **Domain:** `servis.lisztrapszodia.in.rs`, a CNAME at Loopia pointing to Railway, with Railway-issued TLS. The old app keeps running on `sb.lisztrapszodia.in.rs` untouched until the owner deactivates it after cutover.
- **Dockerfile** follows bakery-mono:
  - copy every workspace `package.json`, then `npm ci --ignore-scripts`
  - build
  - `CMD prisma migrate deploy && node dist/index.js`
- **Tenancy:** one deployment per company. See [ADR-0002](./docs/adr/0002-one-deployment-per-company.md).
- **Photos** (post-parity) go in Cloudflare R2: free up to 10 GB with no egress fees.

### Railway Hobby cost estimate

These figures are based on bakery-mono's measured 7-day usage.

| App | RAM (avg) | ≈ Monthly cost |
|---|---|---|
| bakery-mono (all services + Postgres) | ~262 MB | ~$2.8 |
| Service Book (app + Postgres) | ~180 MB | ~$2.0 |
| **Total** | ~440 MB | **~$4.8–5.5** |

The Hobby plan includes $5 of usage, so the expected bill is **about $5–6/month** for both apps. The single-origin setup avoids an nginx container, which saves about 40 MB, or about $0.45/month.
