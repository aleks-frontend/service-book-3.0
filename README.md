# Service Book 3.0

Back-office app for a repair shop. Stack and layout: [`techstack.md`](./techstack.md). Plan: [`implementation-plan.md`](./implementation-plan.md).

## Getting started

Requires Node.js 22 and a local Postgres.

1. Create three databases: `servicebook` (dev), `servicebook_test` (Vitest) and `servicebook_e2e` (Playwright).
2. `cp apps/backend/.env.example apps/backend/.env` and fill it in (`openssl rand -base64 32` for `BETTER_AUTH_SECRET`).
3. Install, migrate and seed a staff member:
   ```sh
   npm install
   npm run prisma:migrate -w @servicebook/backend
   npm run prisma:seed -w @servicebook/backend
   ```
4. Run `npm run dev:backend` and `npm run dev:admin-panel`, then open http://localhost:5173. Vite proxies `/api` to the backend.

There is no sign-up. Add more staff members with:

```sh
npm run staff:create -w @servicebook/backend -- <email> <password> [name]
```

## Scripts

| Command | What it does |
|---|---|
| `npm run typecheck` | Typechecks every workspace and the e2e tests |
| `npm run lint` | ESLint |
| `npm test` | Vitest + Supertest API tests against `TEST_DATABASE_URL` (wiped between tests) |
| `npm run test:e2e` | Builds for production and runs Playwright against `E2E_DATABASE_URL` (wiped every run) |
| `npm run build` then `npm start` | Production: Express serves the admin panel and `/api` from one origin ([ADR-0001](./docs/adr/0001-single-origin.md)) |

## Deploying

Production runs on Railway as one service built from the root `Dockerfile`, plus Railway Postgres ([ADR-0001](./docs/adr/0001-single-origin.md)). Pushing to `master` deploys. The container runs `prisma migrate deploy` before starting, so migrations apply on every deploy.

Variables on the app service:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference) |
| `BETTER_AUTH_SECRET` | A fresh `openssl rand -base64 32`, not the local one |
| `BETTER_AUTH_URL` | The public URL: the `https://….up.railway.app` one until the custom domain exists, then `https://servis.lisztrapszodia.in.rs` |
| `TRUSTED_ORIGINS` | Every exact URL staff log in on, comma-separated, e.g. `https://servis.lisztrapszodia.in.rs,https://app-production-xxxx.up.railway.app` (no wildcards, no trailing slash) |
| `SENTRY_DSN` | DSN of the backend Sentry project |
| `VITE_SENTRY_DSN` | DSN of the admin-panel Sentry project. Inlined at build time (Docker build arg), so changing it needs a redeploy |

Railway sets `PORT` itself. Don't set the `SEED_STAFF_*` variables on the service; pass them once when seeding.

Create the first staff member from inside the running container (`railway ssh`, since the database is only reachable on Railway's private network):

```sh
cd /workspace/apps/backend
SEED_STAFF_EMAIL=<email> SEED_STAFF_PASSWORD=<password> SEED_STAFF_NAME=<name> npm run prisma:seed
# more staff members later:
npm run staff:create -- <email> <password> [name]
```

To check error reporting:

- **Backend:** log in and open `/api/debug/error`. It throws, and the error should appear in the backend Sentry project.
- **Admin panel:** on any page, run `setTimeout(() => { throw new Error("Sentry admin panel test") })` in the browser console. It should appear in the admin-panel Sentry project. A plain `throw` typed into the console isn't reported; the `setTimeout` makes it a real uncaught error.
