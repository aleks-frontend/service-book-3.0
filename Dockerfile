# One image serves both the API and the built admin panel from one origin
# (ADR-0001). Build context is the repo root:
#   docker build --build-arg VITE_SENTRY_DSN=... -t service-book .
FROM node:22-alpine AS build
WORKDIR /workspace

# Copy every workspace's package.json first (`npm ci` needs all of them present
# to match package-lock.json) so this dependency layer stays cached across
# source-only edits. --ignore-scripts skips the postinstall hooks; their work
# (schemas build, prisma generate) is done explicitly below.
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/admin-panel/package.json apps/admin-panel/package.json
COPY packages/schemas/package.json packages/schemas/package.json
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY packages/schemas packages/schemas
COPY apps/backend apps/backend
COPY apps/admin-panel apps/admin-panel
RUN npm run build -w @servicebook/schemas

# `prisma generate` only reads prisma/schema.prisma to emit the client - it
# never connects to a database - so a placeholder DATABASE_URL is enough here.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN npm exec --workspace @servicebook/backend -- prisma generate
RUN npm run build -w @servicebook/backend

# Vite inlines VITE_* variables at build time, so the DSN must be a build arg.
# Railway passes service variables to build args of the same name.
ARG VITE_SENTRY_DSN
RUN npm run build -w @servicebook/admin-panel

FROM node:22-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production

# Copy each workspace wholesale rather than cherry-picking dist/: npm doesn't
# hoist every dependency to the root node_modules, and a partial copy silently
# misses the nested ones. Dev dependencies stay in, so `prisma` and `tsx` are
# available for migrations and the seed.
COPY --from=build /workspace/node_modules node_modules
COPY --from=build /workspace/package.json /workspace/package-lock.json ./
COPY --from=build /workspace/packages/schemas packages/schemas
COPY --from=build /workspace/apps/backend apps/backend
# src/index.ts resolves the admin panel at ../../admin-panel/dist from its dist/.
COPY --from=build /workspace/apps/admin-panel/dist apps/admin-panel/dist

WORKDIR /workspace/apps/backend
# Railway injects PORT at runtime; src/index.ts reads it (3001 elsewhere).
EXPOSE 3001
# Apply pending migrations before starting, so a deploy never ships code that
# expects tables the database doesn't have yet. `prisma` is a devDependency of
# the backend workspace, so it isn't on PATH; call the hoisted binary directly.
CMD ["sh", "-c", "/workspace/node_modules/.bin/prisma migrate deploy && node dist/index.js"]
