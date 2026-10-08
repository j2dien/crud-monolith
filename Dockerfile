# Versi wajib diberikan melalui build argument.
ARG BUN_VERSION=1

FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app


# Dependencies untuk build dan typecheck.
FROM base AS build-deps

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json

RUN bun install --frozen-lockfile

# Build frontend dan periksa tipe backend.
FROM build-deps AS build

COPY . .

RUN bun run --cwd apps/api typecheck
RUN bun run --cwd apps/web build


# Dependencies yang diperlukan saat runtime.
FROM base AS production-deps

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json

RUN bun install --frozen-lockfile --production


# Image aplikasi.
FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=production-deps --chown=bun:bun /app/ /app/

COPY --from=build --chown=bun:bun /app/apps/api/src/ /app/apps/api/src/
COPY --from=build --chown=bun:bun /app/apps/api/drizzle/ /app/apps/api/drizzle/

COPY --from=build --chown=bun:bun /app/packages/contracts/src/ /app/packages/contracts/src/
COPY --from=build --chown=bun:bun /app/apps/web/dist/ /app/apps/web/dist/

WORKDIR /app/apps/api

USER bun

EXPOSE 3000

CMD ["bun", "src/index.ts"]