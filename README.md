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
